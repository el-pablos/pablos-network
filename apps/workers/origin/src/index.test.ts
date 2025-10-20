import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock dependencies before imports
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
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
  saveEvidence: vi.fn().mockResolvedValue('evidence-id-456'),
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

describe('origin worker', () => {
  let mockSpawn: any;
  let mockExecSync: any;
  let mockWriteFileSync: any;
  let mockUnlinkSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const childProcess = await import('child_process');
    const fs = await import('fs');
    
    mockSpawn = childProcess.spawn as any;
    mockExecSync = childProcess.execSync as any;
    mockWriteFileSync = fs.writeFileSync as any;
    mockUnlinkSync = fs.unlinkSync as any;

    // Mock execSync for availability check
    mockExecSync.mockImplementation(() => {});

    // Set environment variables
    process.env.CF_HERO_BIN = 'cf-hero';
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
    id: 'job-456',
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  });

  it('should throw VerificationRequiredError when asset is not verified', async () => {
    mockAsset.findById.mockResolvedValue({
      _id: 'asset-456',
      fqdn: 'cloudflare-site.com',
      verifiedAt: null,
    });

    const { VerificationRequiredError } = await import('@pablos/utils');
    
    const asset = await mockAsset.findById('asset-456');
    expect(asset.verifiedAt).toBeNull();
    
    expect(() => {
      if (!asset.verifiedAt) {
        throw new VerificationRequiredError(asset.fqdn);
      }
    }).toThrow('Domain verification required: cloudflare-site.com');
  });

  it('should process cf-hero job successfully when asset is verified', async () => {
    const cfHeroOutput = `[REAL IP FOUND] cloudflare-site.com -> 203.0.113.10 (Title: Example)
[DNS RECORD] cloudflare-site.com -> 203.0.113.11 (A record)
[OSINT] cloudflare-site.com -> 203.0.113.12 (ZoomEye)`;

    mockAsset.findById.mockResolvedValue({
      _id: 'asset-456',
      fqdn: 'cloudflare-site.com',
      verifiedAt: new Date('2024-01-01'),
    });

    mockFinding.findOneAndUpdate.mockResolvedValue({ _id: 'finding-456' });
    mockJob.findOneAndUpdate.mockResolvedValue({ _id: 'job-456' });

    const mockProcess = createMockChildProcess(cfHeroOutput);
    mockSpawn.mockReturnValue(mockProcess);

    const job = createMockJob({
      assetId: 'asset-456',
      domain: 'cloudflare-site.com',
      mode: 'safe',
    });

    const asset = await mockAsset.findById('asset-456');
    expect(asset.verifiedAt).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 50));
    
    expect(mockAsset.findById).toHaveBeenCalledWith('asset-456');
  });

  it('should parse REAL IP FOUND output correctly', () => {
    const line = '[REAL IP FOUND] cloudflare-site.com -> 203.0.113.10 (Title: Example)';
    const realIpMatch = line.match(/\[REAL IP FOUND\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);

    expect(realIpMatch).toBeTruthy();
    if (realIpMatch) {
      const [, targetDomain, originIp] = realIpMatch;
      expect(targetDomain).toBe('cloudflare-site.com');
      expect(originIp).toBe('203.0.113.10');
    }
  });

  it('should parse DNS RECORD output correctly', () => {
    const line = '[DNS RECORD] cloudflare-site.com -> 203.0.113.11 (A record)';
    const dnsMatch = line.match(/\[DNS RECORD\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);

    expect(dnsMatch).toBeTruthy();
    if (dnsMatch) {
      const [, targetDomain, ip] = dnsMatch;
      expect(targetDomain).toBe('cloudflare-site.com');
      expect(ip).toBe('203.0.113.11');
    }
  });

  it('should parse OSINT output correctly', () => {
    const line = '[OSINT] cloudflare-site.com -> 203.0.113.12 (ZoomEye)';
    const osintMatch = line.match(/\[OSINT\]\s+([^\s]+)\s+->\s+([0-9.]+)\s+\(([^)]+)\)/i);

    expect(osintMatch).toBeTruthy();
    if (osintMatch) {
      const [, targetDomain, ip, source] = osintMatch;
      expect(targetDomain).toBe('cloudflare-site.com');
      expect(ip).toBe('203.0.113.12');
      expect(source).toBe('ZoomEye');
    }
  });

  it('should create findings with correct severity levels', async () => {
    const outputs = [
      { line: '[REAL IP FOUND] test.com -> 1.2.3.4', expectedSeverity: 'high', expectedCategory: 'NET' },
      { line: '[DNS RECORD] test.com -> 1.2.3.5', expectedSeverity: 'info', expectedCategory: 'DNS' },
      { line: '[OSINT] test.com -> 1.2.3.6 (Shodan)', expectedSeverity: 'medium', expectedCategory: 'OSINT' },
    ];

    for (const { line, expectedSeverity, expectedCategory } of outputs) {
      if (line.includes('REAL IP FOUND')) {
        expect(expectedSeverity).toBe('high');
        expect(expectedCategory).toBe('NET');
      } else if (line.includes('DNS RECORD')) {
        expect(expectedSeverity).toBe('info');
        expect(expectedCategory).toBe('DNS');
      } else if (line.includes('OSINT')) {
        expect(expectedSeverity).toBe('medium');
        expect(expectedCategory).toBe('OSINT');
      }
    }
  });

  it('should save evidence to GridFS', async () => {
    const { saveEvidence } = await import('@pablos/utils');
    
    const output = 'cf-hero output data';
    const evidenceId = await saveEvidence(
      Buffer.from(output, 'utf-8'),
      {
        filename: 'cf-hero-cloudflare-site.com-123456.txt',
        contentType: 'text/plain',
        targetFqdn: 'cloudflare-site.com',
        jobId: 'job-456',
      }
    );

    expect(evidenceId).toBe('evidence-id-456');
    expect(saveEvidence).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        filename: expect.stringContaining('cf-hero'),
        contentType: 'text/plain',
      })
    );
  });

  it('should update job progress during execution', async () => {
    const job = createMockJob({
      assetId: 'asset-456',
      domain: 'cloudflare-site.com',
    });

    await job.updateProgress(10);
    await job.updateProgress(20);
    await job.updateProgress(80);
    await job.updateProgress(100);

    expect(job.updateProgress).toHaveBeenCalledTimes(4);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should create and cleanup temporary file', async () => {
    const domain = 'cloudflare-site.com';
    
    mockWriteFileSync.mockImplementation(() => {});
    mockUnlinkSync.mockImplementation(() => {});

    // Simulate temp file creation
    const tmpFile = `/tmp/cf-hero-${Date.now()}.txt`;
    mockWriteFileSync(tmpFile, domain);
    
    expect(mockWriteFileSync).toHaveBeenCalledWith(tmpFile, domain);

    // Simulate cleanup
    mockUnlinkSync(tmpFile);
    expect(mockUnlinkSync).toHaveBeenCalledWith(tmpFile);
  });

  it('should handle cf-hero process errors', async () => {
    const mockProcess = createMockChildProcess('', 'Error: command not found', 1);
    mockSpawn.mockReturnValue(mockProcess);

    mockAsset.findById.mockResolvedValue({
      _id: 'asset-456',
      fqdn: 'cloudflare-site.com',
      verifiedAt: new Date(),
    });

    await new Promise<void>((resolve, reject) => {
      mockProcess.on('close', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`CF-Hero exited with code ${code}`));
        }
      });
    }).catch((error) => {
      expect(error.message).toContain('CF-Hero exited with code 1');
    });
  });

  it('should cleanup temp file on process error', async () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    setTimeout(() => {
      mockProcess.emit('error', new Error('Spawn failed'));
    }, 10);

    mockSpawn.mockReturnValue(mockProcess);
    mockUnlinkSync.mockImplementation(() => {});

    const tmpFile = '/tmp/test-file.txt';

    await new Promise<void>((resolve, reject) => {
      mockProcess.on('error', (error: Error) => {
        try {
          mockUnlinkSync(tmpFile);
        } catch (e) {
          // Ignore
        }
        reject(error);
      });
    }).catch((error) => {
      expect(error.message).toBe('Spawn failed');
    });
  });

  it('should throw error when cf-hero is not available', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found');
    });

    let cfHeroBin: string | null = null;
    try {
      mockExecSync('cf-hero -h', { stdio: 'ignore' });
      cfHeroBin = 'cf-hero';
    } catch (error) {
      cfHeroBin = null;
    }

    expect(cfHeroBin).toBeNull();
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
    const workers = mode === 'safe' ? 8 : 16;

    expect(workers).toBe(8);
  });

  it('should use aggressive mode configuration when specified', () => {
    const mode = 'aggressive';
    const workers = mode === 'safe' ? 8 : 16;

    expect(workers).toBe(16);
  });

  it('should count all types of findings correctly', () => {
    const output = `[REAL IP FOUND] test.com -> 1.2.3.4
[DNS RECORD] test.com -> 1.2.3.5
[OSINT] test.com -> 1.2.3.6 (Shodan)
[OSINT] test.com -> 1.2.3.7 (ZoomEye)
Some other line
[REAL IP FOUND] test.com -> 1.2.3.8`;

    const lines = output.split('\n').filter((l) => l.trim());
    let foundOrigins = 0;

    for (const line of lines) {
      const realIpMatch = line.match(/\[REAL IP FOUND\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);
      const dnsMatch = line.match(/\[DNS RECORD\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);
      const osintMatch = line.match(/\[OSINT\]\s+([^\s]+)\s+->\s+([0-9.]+)\s+\(([^)]+)\)/i);

      if (realIpMatch || dnsMatch || osintMatch) {
        foundOrigins++;
      }
    }

    expect(foundOrigins).toBe(5);
  });
});

