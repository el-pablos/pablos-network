import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

// Mock fs
const mockFs = {
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
};

vi.mock('fs', () => ({
  default: mockFs,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

// Mock path
vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
  },
  join: (...args: string[]) => args.join('/'),
}));

// Mock os
vi.mock('os', () => ({
  default: {
    tmpdir: () => '/tmp',
  },
  tmpdir: () => '/tmp',
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

describe('Origin Worker', () => {
  let processCfHeroJob: any;
  let mockJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('CF_HERO_BIN', 'cf-hero');

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
      processCfHeroJob = workerCalls[workerCalls.length - 1][1];
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

    await expect(processCfHeroJob(mockJob)).rejects.toThrow('Domain verification required');
  });

  it('should throw error when asset is not found', async () => {
    mockAssetModel.findById.mockResolvedValue(null);

    await expect(processCfHeroJob(mockJob)).rejects.toThrow('Asset not found');
  });

  it('should throw error when cf-hero is not available', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found');
    });

    await expect(processCfHeroJob(mockJob)).rejects.toThrow('cf-hero is not installed or not in PATH');
  });

  it('should use default cf-hero binary when CF_HERO_BIN is not set', async () => {
    // Unset CF_HERO_BIN to test the default branch
    vi.unstubAllEnvs();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    // Do NOT set CF_HERO_BIN
    delete process.env.CF_HERO_BIN;
    expect(process.env.CF_HERO_BIN).toBeUndefined();

    // Track which binary was used in execSync (for availability check)
    let usedBinary: string | undefined;

    mockExecSync.mockImplementation((cmd: string) => {
      const cmdStr = cmd.toString();
      usedBinary = cmdStr.split(' ')[0];
      // Return success for the availability check
      return Buffer.from('');
    });

    // Process a job which will trigger checkCfHeroAvailability
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    // Emit data and close to complete the job
    mockProcess.stdout.emit('data', Buffer.from('[INFO] Test'));
    mockProcess.emit('close', 0);

    await jobPromise;

    // Verify that 'cf-hero' (the default) was used in the availability check
    expect(usedBinary).toBe('cf-hero');
  });

  it('should process cf-hero job successfully with REAL IP findings', async () => {
    const cfHeroOutput = `
[INFO] Starting CF-Hero scan for example.com
[REAL IP FOUND] example.com -> 192.168.1.100
[INFO] Scan completed
`;

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(cfHeroOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should process DNS record findings', async () => {
    const cfHeroOutput = `[DNS RECORD] example.com -> 10.0.0.1`;

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(cfHeroOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should process OSINT findings', async () => {
    const cfHeroOutput = `[OSINT] example.com -> 172.16.0.1 (Shodan)`;

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(cfHeroOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('should process multiple findings from output', async () => {
    const cfHeroOutput = `
[REAL IP FOUND] example.com -> 192.168.1.100
[DNS RECORD] example.com -> 10.0.0.1
[OSINT] example.com -> 172.16.0.1 (Shodan)
`;

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from(cfHeroOutput));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledTimes(3);
  });

  it('should handle cf-hero process error with non-zero exit code', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 1);

    await expect(jobPromise).rejects.toThrow('CF-Hero exited with code 1');
  });

  it('should handle cf-hero spawn error', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('error', new Error('Spawn failed'));

    await expect(jobPromise).rejects.toThrow('Spawn failed');
  });

  it('should use correct workers count in safe mode', async () => {
    mockJob.data.mode = 'safe';

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    await jobPromise;

    const { spawn } = await import('child_process');
    expect(spawn).toHaveBeenCalledWith(
      'cf-hero',
      expect.arrayContaining(['-w', '8'])
    );
  });

  it('should use correct workers count in aggressive mode', async () => {
    mockJob.data.mode = 'aggressive';

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    await jobPromise;

    const { spawn } = await import('child_process');
    expect(spawn).toHaveBeenCalledWith(
      'cf-hero',
      expect.arrayContaining(['-w', '16'])
    );
  });

  it('should clean up temp file on success', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });

  it('should clean up temp file on error', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('error', new Error('Spawn failed'));

    await expect(jobPromise).rejects.toThrow();
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });

  it('should log stdout data', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stdout.emit('data', Buffer.from('Test output'));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should log stderr data', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.stderr.emit('data', Buffer.from('Test error'));
    mockProcess.emit('close', 0);

    await jobPromise;

    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should handle process close with null code', async () => {
    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', null);

    await expect(jobPromise).resolves.toBeDefined();
  });

  it('should handle file cleanup error on successful close', async () => {
    // Make unlinkSync throw an error
    mockFs.unlinkSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('close', 0);

    // Should still resolve despite cleanup error
    await expect(jobPromise).resolves.toBeDefined();

    // Should log warning about cleanup failure
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Failed to delete temp file'
    );
  });

  it('should handle file cleanup error on spawn error', async () => {
    // Make unlinkSync throw an error
    mockFs.unlinkSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const jobPromise = processCfHeroJob(mockJob);
    await new Promise(resolve => setImmediate(resolve));

    mockProcess.emit('error', new Error('Spawn failed'));

    // Should still reject with the spawn error, not the cleanup error
    await expect(jobPromise).rejects.toThrow('Spawn failed');

    // Cleanup error should be silently ignored (line 129)
  });
});

describe('Origin Worker Initialization', () => {
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
      'Failed to start origin worker'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
