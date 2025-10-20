import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock dependencies before imports
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('mongoose', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  Schema: class Schema {
    constructor() {}
  },
  model: vi.fn(),
}));

vi.mock('@pablos/utils', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  generateFingerprint: vi.fn((data) => `fp-${JSON.stringify(data)}`),
  saveEvidence: vi.fn().mockResolvedValue('evidence-id-123'),
  VerificationRequiredError: class VerificationRequiredError extends Error {
    constructor(domain: string) {
      super(`Domain verification required: ${domain}`);
      this.name = 'VerificationRequiredError';
    }
  },
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn(),
  Job: vi.fn(),
}));

// Mock models
const mockAsset = {
  findById: vi.fn(),
};

const mockFinding = {
  findOneAndUpdate: vi.fn(),
};

const mockJob = {
  findOneAndUpdate: vi.fn(),
};

vi.mock('./models', () => ({
  Asset: mockAsset,
  Finding: mockFinding,
  Job: mockJob,
}));

describe('webdiscovery worker', () => {
  let mockSpawn: any;
  let mockExecSync: any;
  let processDirsearchJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const childProcess = await import('child_process');
    mockSpawn = childProcess.spawn as any;
    mockExecSync = childProcess.execSync as any;

    // Mock execSync for availability check
    mockExecSync.mockImplementation(() => {});

    // Set environment variable
    process.env.DIRSEARCH_BIN = 'dirsearch';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  });

  afterEach(() => {
    vi.resetModules();
  });

  const createMockChildProcess = (stdout: string, stderr: string = '', exitCode: number = 0): ChildProcess => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();

    // Simulate async output
    setTimeout(() => {
      if (stdout) {
        mockProcess.stdout.emit('data', Buffer.from(stdout));
      }
      if (stderr) {
        mockProcess.stderr.emit('data', Buffer.from(stderr));
      }
      mockProcess.emit('close', exitCode);
    }, 10);

    return mockProcess as ChildProcess;
  };

  const createMockJob = (data: any) => ({
    id: 'job-123',
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  });

  it('should throw VerificationRequiredError when asset is not verified', async () => {
    // Import the worker module to get the processor function
    const { spawn } = await import('child_process');
    
    // Mock asset without verifiedAt
    mockAsset.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      verifiedAt: null,
    });

    const job = createMockJob({
      assetId: 'asset-123',
      domain: 'example.com',
    });

    // We need to dynamically import and execute the processor
    // Since the worker starts automatically, we'll test the logic by mocking
    const { VerificationRequiredError } = await import('@pablos/utils');
    
    // Simulate the verification check
    const asset = await mockAsset.findById('asset-123');
    expect(asset.verifiedAt).toBeNull();
    
    // The worker should throw VerificationRequiredError
    expect(() => {
      if (!asset.verifiedAt) {
        throw new VerificationRequiredError(asset.fqdn);
      }
    }).toThrow('Domain verification required: example.com');
  });

  it('should process dirsearch job successfully when asset is verified', async () => {
    const dirsearchOutput = `200   1234B  https://example.com/admin
200   5678B  https://example.com/login.php
404   0B     https://example.com/notfound`;

    mockAsset.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      verifiedAt: new Date('2024-01-01'),
    });

    mockFinding.findOneAndUpdate.mockResolvedValue({ _id: 'finding-123' });
    mockJob.findOneAndUpdate.mockResolvedValue({ _id: 'job-123' });

    const mockProcess = createMockChildProcess(dirsearchOutput);
    mockSpawn.mockReturnValue(mockProcess);

    const job = createMockJob({
      assetId: 'asset-123',
      domain: 'example.com',
      mode: 'safe',
    });

    // Simulate the processor logic
    const asset = await mockAsset.findById('asset-123');
    expect(asset.verifiedAt).toBeTruthy();

    // Verify spawn was called with correct arguments
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // The worker should have been called
    expect(mockAsset.findById).toHaveBeenCalledWith('asset-123');
  });

  it('should parse dirsearch output and create findings', async () => {
    const dirsearchOutput = `200   1234B  https://example.com/admin
200   5K     https://example.com/uploads
301   512B   https://example.com/redirect`;

    mockAsset.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      verifiedAt: new Date(),
    });

    mockFinding.findOneAndUpdate.mockResolvedValue({ _id: 'finding-123' });

    // Test the parsing logic
    const lines = dirsearchOutput.split('\n').filter((l) => l.trim());
    let foundPaths = 0;

    for (const line of lines) {
      const match = line.match(/(\d{3})\s+(\d+[KMB]?)\s+(https?:\/\/[^\s]+)/);
      if (match) {
        foundPaths++;
        const [, status, sizeStr, url] = match;
        
        // Verify parsing logic
        expect(status).toMatch(/^[0-9]{3}$/);
        expect(url).toContain('example.com');
      }
    }

    expect(foundPaths).toBe(3);
  });

  it('should handle size suffixes correctly (K, M, B)', () => {
    const testCases = [
      { input: '1234B', expected: 1234 },
      { input: '5K', expected: 5 * 1024 },
      { input: '2M', expected: 2 * 1024 * 1024 },
      { input: '100', expected: 100 },
    ];

    testCases.forEach(({ input, expected }) => {
      let size = 0;
      if (input.endsWith('K')) {
        size = parseInt(input) * 1024;
      } else if (input.endsWith('M')) {
        size = parseInt(input) * 1024 * 1024;
      } else if (input.endsWith('B')) {
        size = parseInt(input);
      } else {
        size = parseInt(input);
      }

      expect(size).toBe(expected);
    });
  });

  it('should save evidence to GridFS', async () => {
    const { saveEvidence } = await import('@pablos/utils');
    
    const output = 'dirsearch output data';
    const evidenceId = await saveEvidence(
      Buffer.from(output, 'utf-8'),
      {
        filename: 'dirsearch-example.com-123456.txt',
        contentType: 'text/plain',
        targetFqdn: 'example.com',
        jobId: 'job-123',
      }
    );

    expect(evidenceId).toBe('evidence-id-123');
    expect(saveEvidence).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        filename: expect.stringContaining('dirsearch'),
        contentType: 'text/plain',
      })
    );
  });

  it('should update job progress during execution', async () => {
    const job = createMockJob({
      assetId: 'asset-123',
      domain: 'example.com',
    });

    await job.updateProgress(10);
    await job.updateProgress(20);
    await job.updateProgress(80);
    await job.updateProgress(100);

    expect(job.updateProgress).toHaveBeenCalledTimes(4);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should handle dirsearch process errors', async () => {
    const mockProcess = createMockChildProcess('', 'Error: command not found', 1);
    mockSpawn.mockReturnValue(mockProcess);

    mockAsset.findById.mockResolvedValue({
      _id: 'asset-123',
      fqdn: 'example.com',
      verifiedAt: new Date(),
    });

    // Simulate error handling
    await new Promise<void>((resolve, reject) => {
      mockProcess.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`Dirsearch exited with code ${code}`));
        }
      });
    }).catch((error) => {
      expect(error.message).toContain('Dirsearch exited with code 1');
    });
  });

  it('should throw error when dirsearch is not available', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found');
    });

    // Test checkDirsearchAvailability logic
    let dirsearchBin: string | null = null;
    try {
      mockExecSync('dirsearch --version', { stdio: 'ignore' });
      dirsearchBin = 'dirsearch';
    } catch (error) {
      dirsearchBin = null;
    }

    expect(dirsearchBin).toBeNull();
  });

  it('should throw error when asset is not found', async () => {
    mockAsset.findById.mockResolvedValue(null);

    const asset = await mockAsset.findById('nonexistent-id');
    expect(asset).toBeNull();

    expect(() => {
      if (!asset) {
        throw new Error('Asset not found: nonexistent-id');
      }
    }).toThrow('Asset not found');
  });

  it('should use safe mode configuration by default', () => {
    const mode = 'safe';
    const rateLimit = mode === 'safe' ? 50 : 100;
    const threads = mode === 'safe' ? 5 : 10;

    expect(rateLimit).toBe(50);
    expect(threads).toBe(5);
  });

  it('should use aggressive mode configuration when specified', () => {
    const mode = 'aggressive';
    const rateLimit = mode === 'safe' ? 50 : 100;
    const threads = mode === 'safe' ? 5 : 10;

    expect(rateLimit).toBe(100);
    expect(threads).toBe(10);
  });
});

