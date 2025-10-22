import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock BullMQ
const mockWorker = { on: vi.fn() };

vi.mock('bullmq', () => ({
  Worker: vi.fn(() => mockWorker),
}));

// Mock mongoose
const mockAssetModel = {
  findById: vi.fn(),
};

const mockJobModel = {
  findOneAndUpdate: vi.fn(),
};

const mockFindingModel = {
  findOneAndUpdate: vi.fn(),
};

vi.mock('mongoose', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  model: vi.fn((name: string) => {
    if (name === 'Asset') return mockAssetModel;
    if (name === 'Job') return mockJobModel;
    if (name === 'Finding') return mockFindingModel;
    return {};
  }),
  Schema: vi.fn(),
}));

// Mock child_process
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

let mockProcess: MockChildProcess;
let mockExecSync: any;

mockExecSync = vi.fn(() => Buffer.from(''));

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    mockProcess = new MockChildProcess();
    return mockProcess;
  }),
  execSync: mockExecSync,
}));

// Mock utils
const mockRedis = { duplicate: vi.fn() };
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};
const mockSaveEvidence = vi.fn();

vi.mock('@pablos/utils', () => ({
  redis: mockRedis,
  createLogger: vi.fn(() => mockLogger),
  generateFingerprint: vi.fn((data: any) => `fingerprint-${JSON.stringify(data)}`),
  saveEvidence: mockSaveEvidence,
  VerificationRequiredError: class VerificationRequiredError extends Error {
    constructor(domain: string) {
      super(`Domain verification required: ${domain}`);
      this.name = 'VerificationRequiredError';
    }
  },
}));

// Mock models
vi.mock('./models', () => ({
  Asset: mockAssetModel,
  Finding: mockFindingModel,
  Job: mockJobModel,
}));

describe('WebDiscovery Worker', () => {
  let processDirsearchJob: any;
  let mockJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('DIRSEARCH_BIN', 'dirsearch');

    mockAssetModel.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      type: 'domain',
      active: true,
      owner: 'user-123',
      verifiedAt: new Date('2024-01-01'),
    });

    mockJobModel.findOneAndUpdate.mockResolvedValue({});
    mockFindingModel.findOneAndUpdate.mockResolvedValue({});
    mockSaveEvidence.mockResolvedValue('evidence-id-123');
    mockExecSync.mockImplementation(() => Buffer.from(''));

    mockJob = {
      id: 'job-123',
      data: {
        assetId: 'asset-123',
        domain: 'example.com',
        mode: 'safe',
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue(undefined),
    };

    // Import module - THIS IS CRITICAL FOR COVERAGE
    vi.resetModules();
    const module = await import('./index');

    const { Worker } = await import('bullmq');
    const workerCalls = vi.mocked(Worker).mock.calls;
    if (workerCalls.length > 0) {
      processDirsearchJob = workerCalls[workerCalls.length - 1][1];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should throw VerificationRequiredError when asset is not verified', async () => {
    mockAssetModel.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      type: 'domain',
      active: true,
      owner: 'user-123',
      verifiedAt: null,
    });

    await expect(processDirsearchJob(mockJob)).rejects.toThrow('Domain verification required');
  });

  it('should throw error when asset is not found', async () => {
    mockAssetModel.findById.mockResolvedValue(null);

    await expect(processDirsearchJob(mockJob)).rejects.toThrow('Asset not found');
  });

  it('should throw error when dirsearch is not available', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found');
    });

    await expect(processDirsearchJob(mockJob)).rejects.toThrow('dirsearch is not installed or not in PATH');
  });

  it('should use default dirsearch binary when DIRSEARCH_BIN is not set', async () => {
    // Unset DIRSEARCH_BIN to test the default branch
    vi.unstubAllEnvs();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    // Do NOT set DIRSEARCH_BIN
    delete process.env.DIRSEARCH_BIN;
    expect(process.env.DIRSEARCH_BIN).toBeUndefined();

    // Track which binary was used in execSync (for availability check)
    let usedBinary: string | undefined;

    mockExecSync.mockImplementation((cmd: string) => {
      const cmdStr = cmd.toString();
      usedBinary = cmdStr.split(' ')[0];
      // Return success for the availability check
      return Buffer.from('');
    });

    // Process a job which will trigger checkDirsearchAvailability
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    // Emit data and close to complete the job
    mockProcess.stdout.emit('data', Buffer.from('200   1234B  https://example.com/test'));
    mockProcess.emit('close', 0);

    await jobPromise;

    // Verify that 'dirsearch' (the default) was used in the availability check
    expect(usedBinary).toBe('dirsearch');
  });

  it('should process dirsearch job successfully with findings', async () => {
    const dirsearchOutput = `200   1234B  https://example.com/admin
200   5678B  https://example.com/login.php`;

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(dirsearchOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should parse findings with K suffix', async () => {
    const dirsearchOutput = `200   5K  https://example.com/uploads`;

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(dirsearchOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should parse findings with M suffix', async () => {
    const dirsearchOutput = `200   2M  https://example.com/bigfile`;

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(dirsearchOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should handle non-2xx status codes with low severity', async () => {
    const dirsearchOutput = `403   1234B  https://example.com/forbidden
301   567B  https://example.com/redirect`;

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(dirsearchOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    // Verify that findings were created with 'low' severity (not 'info')
    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: expect.any(String),
      }),
      expect.objectContaining({
        severity: 'low',
      }),
      { upsert: true, new: true }
    );
  });

  it('should handle dirsearch process error with non-zero exit code', async () => {
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 1);

    await expect(jobPromise).rejects.toThrow('Dirsearch exited with code 1');
  });

  it('should handle dirsearch spawn error', async () => {
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('error', new Error('Spawn failed'));

    await expect(jobPromise).rejects.toThrow('Spawn failed');
  });

  it('should use correct rate limit in safe mode', async () => {
    mockJob.data.mode = 'safe';

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    await jobPromise;

    const { spawn } = await import('child_process');
    expect(spawn).toHaveBeenCalledWith(
      'dirsearch',
      expect.arrayContaining(['--rate-limit', '50'])
    );
  });

  it('should use correct rate limit in aggressive mode', async () => {
    mockJob.data.mode = 'aggressive';

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    await jobPromise;

    const { spawn } = await import('child_process');
    expect(spawn).toHaveBeenCalledWith(
      'dirsearch',
      expect.arrayContaining(['--rate-limit', '100'])
    );
  });

  it('should log stdout data', async () => {
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from('Test output'));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should log stderr data', async () => {
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stderr.emit('data', Buffer.from('Test error'));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle process close with null code', async () => {
    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', null);

    await expect(jobPromise).resolves.toBeDefined();
  });

  it('should parse file size without unit suffix', async () => {
    const dirsearchOutput = `200   1234   http://example.com/test.txt`;

    const jobPromise = processDirsearchJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(dirsearchOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        metadata: expect.objectContaining({
          size: 1234,
        }),
      }),
      expect.any(Object)
    );
  });
});

describe('Webdiscovery Worker Initialization', () => {
  it('should register completed event handler', async () => {
    // Import the module to trigger initialization
    await import('./index');

    // Verify worker.on('completed') was called
    expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
  });

  it('should register failed event handler', async () => {
    // Import the module to trigger initialization
    await import('./index');

    // Verify worker.on('failed') was called
    expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('should log when job completes', async () => {
    // Import the module to trigger initialization
    await import('./index');

    // Get the completed handler
    const completedHandler = mockWorker.on.mock.calls.find(
      (call: any) => call[0] === 'completed'
    )?.[1];

    expect(completedHandler).toBeDefined();

    // Call the handler with a mock job
    if (completedHandler) {
      completedHandler({ id: 'test-job-123' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { jobId: 'test-job-123' },
        'Job completed'
      );
    }
  });

  it('should log when job fails', async () => {
    // Import the module to trigger initialization
    await import('./index');

    // Get the failed handler
    const failedHandler = mockWorker.on.mock.calls.find(
      (call: any) => call[0] === 'failed'
    )?.[1];

    expect(failedHandler).toBeDefined();

    // Call the handler with a mock job and error
    if (failedHandler) {
      const testError = new Error('Job processing failed');
      failedHandler({ id: 'test-job-456' }, testError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: 'test-job-456', error: testError },
        'Job failed'
      );
    }
  });

  it('should handle startup error and exit process', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Reset modules to test startup error
    vi.resetModules();

    // Mock mongoose.connect to throw an error
    vi.doMock('mongoose', () => ({
      connect: vi.fn().mockRejectedValue(new Error('MongoDB connection failed')),
      model: vi.fn(),
      Schema: vi.fn(),
    }));

    // Re-import to trigger startup error
    try {
      await import('./index?t=' + Date.now());
    } catch (error) {
      // Expected to fail
    }

    // Wait for error handler to execute
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify error was logged and process.exit was called
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to start webdiscovery worker'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});

