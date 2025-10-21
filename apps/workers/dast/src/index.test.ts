import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock BullMQ
const mockWorker = { on: vi.fn() };

vi.mock('bullmq', () => ({
  Worker: vi.fn(() => mockWorker),
}));

// Mock mongoose
const mockJobModel = {
  findOneAndUpdate: vi.fn(),
};

const mockFindingModel = {
  findOneAndUpdate: vi.fn(),
};

vi.mock('mongoose', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  model: vi.fn((name: string) => {
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

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    mockProcess = new MockChildProcess();
    return mockProcess;
  }),
}));

// Mock fs
const mockFs = {
  existsSync: vi.fn(),
  mkdtempSync: vi.fn(),
  readFileSync: vi.fn(),
  rmSync: vi.fn(),
};

vi.mock('fs', () => ({
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdtempSync: mockFs.mkdtempSync,
  readFileSync: mockFs.readFileSync,
  rmSync: mockFs.rmSync,
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
}));

// Mock models
vi.mock('./models', () => ({
  Finding: mockFindingModel,
  Job: mockJobModel,
}));

describe('DAST Worker', () => {
  let processZAPJob: any;
  let mockJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('ZAP_PATH', '/usr/local/zap');
    vi.stubEnv('ZAP_BASELINE', '/usr/local/zap/zap-baseline.py');

    mockJobModel.findOneAndUpdate.mockResolvedValue({});
    mockFindingModel.findOneAndUpdate.mockResolvedValue({});
    mockSaveEvidence.mockResolvedValue('evidence-id-123');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdtempSync.mockReturnValue('/tmp/zap-abc123');
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.rmSync.mockReturnValue(undefined);

    mockJob = {
      id: 'job-123',
      data: {
        assetId: 'asset-123',
        domain: 'example.com',
        mode: 'safe',
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    // Import module
    vi.resetModules();
    const module = await import('./index');
    
    const { Worker } = await import('bullmq');
    const workerCalls = vi.mocked(Worker).mock.calls;
    if (workerCalls.length > 0) {
      processZAPJob = workerCalls[workerCalls.length - 1][1];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('checkZAPAvailability', () => {
    it('should return null when ZAP_PATH is not set', async () => {
      vi.stubEnv('ZAP_PATH', '');

      await expect(processZAPJob(mockJob)).rejects.toThrow(
        'OWASP ZAP is not configured'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ZAP_PATH or ZAP_BASELINE environment variables not set'
      );
    });

    it('should return null when ZAP_BASELINE is not set', async () => {
      vi.stubEnv('ZAP_BASELINE', '');

      await expect(processZAPJob(mockJob)).rejects.toThrow(
        'OWASP ZAP is not configured'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ZAP_PATH or ZAP_BASELINE environment variables not set'
      );
    });

    it('should return null when baseline script does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(processZAPJob(mockJob)).rejects.toThrow(
        'OWASP ZAP is not configured'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        { baselinePath: '/usr/local/zap/zap-baseline.py' },
        'ZAP baseline script not found'
      );
    });
  });

  describe('processZAPJob', () => {
    it('should process ZAP job successfully with findings', async () => {
      const zapReport = {
        site: [{
          alerts: [
            {
              name: 'SQL Injection',
              desc: 'SQL injection vulnerability found',
              riskcode: '3',
              solution: 'Use parameterized queries',
              reference: 'https://owasp.org/sql-injection',
              cweid: '89',
              wascid: '19',
              instances: [{ uri: 'https://example.com/login' }],
            },
            {
              name: 'XSS',
              desc: 'Cross-site scripting vulnerability',
              riskcode: '2',
              solution: 'Sanitize user input',
              reference: 'https://owasp.org/xss',
              cweid: '79',
              wascid: '8',
              instances: [{ uri: 'https://example.com/search' }],
            },
          ],
        }],
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(zapReport));

      // Start the job
      const jobPromise = processZAPJob(mockJob);

      // Wait a bit for process to spawn
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate ZAP output
      mockProcess.stdout.emit('data', Buffer.from('ZAP scanning...\n'));
      mockProcess.stdout.emit('data', Buffer.from('Scan complete\n'));

      // Simulate process completion
      mockProcess.emit('close', 0);

      const result = await jobPromise;

      expect(result).toEqual({
        success: true,
        findingsCount: 2,
      });

      // Verify job status updates
      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'running', startedAt: expect.any(Date), progress: 10 }
      );

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        {
          status: 'done',
          finishedAt: expect.any(Date),
          progress: 100,
          message: 'ZAP baseline scan completed - 2 findings',
          metadata: { evidenceId: 'evidence-id-123', findingsCount: 2 },
        }
      );

      // Verify findings created
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          targetRef: 'asset-123',
          provider: 'zap',
          fingerprint: expect.any(String),
        },
        {
          targetRef: 'asset-123',
          targetFqdn: 'example.com',
          provider: 'zap',
          title: 'SQL Injection',
          description: 'SQL injection vulnerability found',
          severity: 'high',
          category: 'WEB',
          metadata: {
            solution: 'Use parameterized queries',
            reference: 'https://owasp.org/sql-injection',
            cweid: '89',
            wascid: '19',
            instances: 1,
          },
          fingerprint: expect.any(String),
        },
        { upsert: true, new: true }
      );

      // Verify evidence saved
      expect(mockSaveEvidence).toHaveBeenCalledWith(
        expect.any(Buffer),
        {
          filename: expect.stringContaining('zap-baseline-example.com'),
          contentType: 'application/json',
          targetFqdn: 'example.com',
          jobId: 'job-123',
        }
      );

      // Verify temp directory cleanup
      expect(mockFs.rmSync).toHaveBeenCalledWith('/tmp/zap-abc123', {
        recursive: true,
        force: true,
      });

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(20);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle ZAP scan with no findings (create summary finding)', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ site: [{ alerts: [] }] }));

      const jobPromise = processZAPJob(mockJob);
      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      const result = await jobPromise;

      expect(result.findingsCount).toBe(1);

      // Verify summary finding created
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: 'ZAP Baseline Scan Completed',
          description: 'OWASP ZAP baseline scan finished. Review full report for details.',
          severity: 'info',
          category: 'WEB',
        }),
        expect.any(Object)
      );
    });

    it('should handle missing JSON report (save console output)', async () => {
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

      const jobPromise = processZAPJob(mockJob);
      await new Promise(resolve => setTimeout(resolve, 10));

      mockProcess.stdout.emit('data', Buffer.from('ZAP console output\n'));
      mockProcess.emit('close', 0);

      const result = await jobPromise;

      expect(result.success).toBe(true);

      // Verify console output saved as evidence
      expect(mockSaveEvidence).toHaveBeenCalledWith(
        expect.any(Buffer),
        {
          filename: expect.stringContaining('zap-baseline-example.com'),
          contentType: 'text/plain',
          targetFqdn: 'example.com',
          jobId: 'job-123',
        }
      );
    });

    it('should handle malformed JSON report', async () => {
      mockFs.readFileSync.mockReturnValue('invalid json {');

      const jobPromise = processZAPJob(mockJob);
      await new Promise(resolve => setTimeout(resolve, 10));
      mockProcess.emit('close', 0);

      const result = await jobPromise;

      expect(result.success).toBe(true);
      expect(result.findingsCount).toBe(1); // Summary finding

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Failed to parse ZAP JSON report'
      );
    });

    it('should handle ZAP process timeout', async () => {
      vi.useFakeTimers();

      const jobPromise = processZAPJob(mockJob).catch(err => err);

      // Use real timers for the promise resolution
      await vi.runOnlyPendingTimersAsync();

      // Advance time to trigger timeout
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1000);

      const error = await jobPromise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('ZAP scan timeout (10 minutes)');

      expect(mockProcess.kill).toHaveBeenCalled();

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'failed', finishedAt: expect.any(Date), error: 'ZAP scan timeout (10 minutes)' }
      );

      vi.useRealTimers();
    }, 10000);

    it('should handle ZAP process spawn error', async () => {
      const jobPromise = processZAPJob(mockJob);

      // Use setImmediate to ensure process is created
      await new Promise(resolve => setImmediate(resolve));

      const spawnError = new Error('Failed to spawn python3');
      mockProcess.emit('error', spawnError);

      await expect(jobPromise).rejects.toThrow('Failed to spawn python3');

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: spawnError },
        'Failed to spawn ZAP'
      );
    });

    it('should handle stderr output', async () => {
      const jobPromise = processZAPJob(mockJob);

      await new Promise(resolve => setImmediate(resolve));

      mockProcess.stderr.emit('data', Buffer.from('Warning: something happened\n'));
      mockProcess.emit('close', 0);

      await jobPromise;

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { text: 'Warning: something happened\n' },
        'ZAP stderr'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.rmSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const jobPromise = processZAPJob(mockJob);

      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 0);

      const result = await jobPromise;

      expect(result.success).toBe(true);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error), tmpDir: '/tmp/zap-abc123' },
        'Failed to cleanup temp directory'
      );
    });

    it('should force safe mode when non-safe mode is requested', async () => {
      mockJob.data.mode = 'aggressive';

      const jobPromise = processZAPJob(mockJob);

      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 0);

      await jobPromise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { mode: 'aggressive' },
        'Only safe mode supported for ZAP, forcing safe mode'
      );
    });

    it('should map risk codes to severity levels correctly', async () => {
      const zapReport = {
        site: [{
          alerts: [
            { name: 'High Risk', riskcode: '3' },
            { name: 'Medium Risk', riskcode: '2' },
            { name: 'Low Risk', riskcode: '1' },
            { name: 'Info Risk', riskcode: '0' },
          ],
        }],
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(zapReport));

      const jobPromise = processZAPJob(mockJob);

      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 0);

      await jobPromise;

      const calls = mockFindingModel.findOneAndUpdate.mock.calls;
      expect(calls[0][1].severity).toBe('high');
      expect(calls[1][1].severity).toBe('medium');
      expect(calls[2][1].severity).toBe('low');
      expect(calls[3][1].severity).toBe('info');
    });

    it('should handle alerts without instances', async () => {
      const zapReport = {
        site: [{
          alerts: [
            {
              name: 'Test Alert',
              desc: 'Test description',
              riskcode: '1',
              // No instances field
            },
          ],
        }],
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(zapReport));

      const jobPromise = processZAPJob(mockJob);

      await new Promise(resolve => setImmediate(resolve));
      mockProcess.emit('close', 0);

      await jobPromise;

      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          metadata: expect.objectContaining({
            instances: 0,
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Worker initialization', () => {
    it('should start worker and connect to MongoDB', async () => {
      const { connect } = await import('mongoose');
      const { Worker } = await import('bullmq');

      expect(connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', {
        dbName: 'pablos-network',
      });

      expect(Worker).toHaveBeenCalledWith('zap', expect.any(Function), {
        connection: mockRedis,
        concurrency: 1,
        limiter: { max: 2, duration: 60000 },
      });

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));

      expect(mockLogger.info).toHaveBeenCalledWith('Starting DAST worker...');
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to MongoDB');
      expect(mockLogger.info).toHaveBeenCalledWith('DAST worker started');
    });

    it('should handle worker completed event', async () => {
      const completedHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'completed'
      )?.[1];

      expect(completedHandler).toBeDefined();

      const mockCompletedJob = { id: 'completed-job-123' };
      completedHandler(mockCompletedJob);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { jobId: 'completed-job-123' },
        'Job completed'
      );
    });

    it('should handle worker failed event', async () => {
      const failedHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'failed'
      )?.[1];

      expect(failedHandler).toBeDefined();

      const mockFailedJob = { id: 'failed-job-123' };
      const mockError = new Error('Job processing failed');
      failedHandler(mockFailedJob, mockError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: 'failed-job-123', error: mockError },
        'Job failed'
      );
    });

    it('should handle worker failed event with null job', async () => {
      const failedHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'failed'
      )?.[1];

      const mockError = new Error('Job processing failed');
      failedHandler(null, mockError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: undefined, error: mockError },
        'Job failed'
      );
    });
  });
});


