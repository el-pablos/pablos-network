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
});

