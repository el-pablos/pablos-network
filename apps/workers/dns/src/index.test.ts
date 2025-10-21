import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock BullMQ
const mockWorker = {
  on: vi.fn(),
};

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

const mockAssetModel = {
  findByIdAndUpdate: vi.fn(),
  findOneAndUpdate: vi.fn(),
};

const mockMetricModel = {
  create: vi.fn(),
};

const mockConnection = new EventEmitter();

vi.mock('mongoose', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  connection: mockConnection,
  model: vi.fn((name: string) => {
    if (name === 'Job') return mockJobModel;
    if (name === 'Finding') return mockFindingModel;
    if (name === 'Asset') return mockAssetModel;
    if (name === 'Metric') return mockMetricModel;
    return {};
  }),
  Schema: vi.fn(),
}));

// Mock DNS promises
const mockDnsPromises = {
  resolve4: vi.fn(),
  resolve6: vi.fn(),
};

vi.mock('dns', () => ({
  promises: mockDnsPromises,
}));

// Mock utils
const mockRedis = { duplicate: vi.fn() };
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@pablos/utils', () => ({
  redis: mockRedis,
  createLogger: vi.fn(() => mockLogger),
  generateFingerprint: vi.fn((data: any) => `fingerprint-${JSON.stringify(data)}`),
}));

// Mock models
vi.mock('./models', () => ({
  Asset: mockAssetModel,
  Finding: mockFindingModel,
  Job: mockJobModel,
  Metric: mockMetricModel,
}));

describe('DNS Worker', () => {
  let processDNSJob: any;
  let mockJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');

    // Reset mocks
    mockJobModel.findOneAndUpdate.mockResolvedValue({});
    mockFindingModel.findOneAndUpdate.mockResolvedValue({});
    mockAssetModel.findByIdAndUpdate.mockResolvedValue({});
    mockAssetModel.findOneAndUpdate.mockResolvedValue({});
    mockMetricModel.create.mockResolvedValue({});

    // Create mock job
    mockJob = {
      id: 'job-123',
      data: {
        assetId: 'asset-123',
        domain: 'example.com',
        mode: 'safe',
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    // Import the module to get processDNSJob
    vi.resetModules();
    const module = await import('./index');
    
    // Extract processDNSJob from the Worker constructor call
    const { Worker } = await import('bullmq');
    const workerCalls = vi.mocked(Worker).mock.calls;
    if (workerCalls.length > 0) {
      processDNSJob = workerCalls[workerCalls.length - 1][1];
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('processDNSJob', () => {
    it('should process DNS job successfully with A records', async () => {
      mockDnsPromises.resolve4.mockResolvedValueOnce(['192.168.1.1', '192.168.1.2']);
      mockDnsPromises.resolve6.mockRejectedValueOnce(new Error('No AAAA records'));
      
      // Mock subdomain resolution - all fail
      mockDnsPromises.resolve4.mockRejectedValue(new Error('NXDOMAIN'));

      const result = await processDNSJob(mockJob);

      expect(result).toEqual({
        success: true,
        foundSubdomains: 0,
        ipAddresses: 2,
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
          message: 'Found 0 subdomains, 2 IPs'
        }
      );

      // Verify findings created for A records
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          targetRef: 'asset-123',
          provider: 'dns',
          fingerprint: expect.any(String),
        },
        {
          targetRef: 'asset-123',
          targetFqdn: 'example.com',
          provider: 'dns',
          category: 'DNS',
          title: 'A Record: 192.168.1.1',
          description: 'Domain example.com resolves to 192.168.1.1',
          severity: 'info',
          fingerprint: expect.any(String),
          metadata: { recordType: 'A', ip: '192.168.1.1' },
        },
        { upsert: true, new: true }
      );

      // Verify asset updated with IPs
      expect(mockAssetModel.findByIdAndUpdate).toHaveBeenCalledWith('asset-123', {
        ip: ['192.168.1.1', '192.168.1.2'],
      });

      // Verify metric created
      expect(mockMetricModel.create).toHaveBeenCalledWith({
        ts: expect.any(Date),
        entity: { kind: 'job', id: 'job-123' },
        name: 'subdomains_found',
        value: 0,
      });

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should process DNS job with AAAA records', async () => {
      mockDnsPromises.resolve4.mockResolvedValueOnce(['192.168.1.1']);
      mockDnsPromises.resolve6.mockResolvedValueOnce(['2001:db8::1', '2001:db8::2']);
      mockDnsPromises.resolve4.mockRejectedValue(new Error('NXDOMAIN'));

      const result = await processDNSJob(mockJob);

      expect(result).toEqual({
        success: true,
        foundSubdomains: 0,
        ipAddresses: 3,
      });

      // Verify asset updated with both IPv4 and IPv6
      expect(mockAssetModel.findByIdAndUpdate).toHaveBeenCalledWith('asset-123', {
        ip: ['192.168.1.1', '2001:db8::1', '2001:db8::2'],
      });
    });

    it('should discover subdomains', async () => {
      mockDnsPromises.resolve4
        .mockResolvedValueOnce(['192.168.1.1']) // Main domain
        .mockResolvedValueOnce(['192.168.1.10']) // www subdomain
        .mockRejectedValueOnce(new Error('NXDOMAIN')) // mail
        .mockResolvedValueOnce(['192.168.1.20']) // ftp subdomain
        .mockRejectedValue(new Error('NXDOMAIN')); // rest fail

      mockDnsPromises.resolve6.mockRejectedValue(new Error('No AAAA'));

      const result = await processDNSJob(mockJob);

      expect(result).toEqual({
        success: true,
        foundSubdomains: 2,
        ipAddresses: 1,
      });

      // Verify subdomain assets created
      expect(mockAssetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { fqdn: 'www.example.com' },
        {
          type: 'subdomain',
          fqdn: 'www.example.com',
          parentFqdn: 'example.com',
          active: true,
          ip: ['192.168.1.10'],
        },
        { upsert: true, new: true }
      );

      expect(mockAssetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { fqdn: 'ftp.example.com' },
        {
          type: 'subdomain',
          fqdn: 'ftp.example.com',
          parentFqdn: 'example.com',
          active: true,
          ip: ['192.168.1.20'],
        },
        { upsert: true, new: true }
      );

      // Verify inactive subdomains marked
      expect(mockAssetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { fqdn: 'mail.example.com' },
        { active: false },
        { upsert: false }
      );

      // Verify metric
      expect(mockMetricModel.create).toHaveBeenCalledWith({
        ts: expect.any(Date),
        entity: { kind: 'job', id: 'job-123' },
        name: 'subdomains_found',
        value: 2,
      });
    });

    it('should handle A record resolution failure', async () => {
      mockDnsPromises.resolve4.mockRejectedValue(new Error('DNS resolution failed'));
      mockDnsPromises.resolve6.mockRejectedValue(new Error('No AAAA'));

      const result = await processDNSJob(mockJob);

      expect(result).toEqual({
        success: true,
        foundSubdomains: 0,
        ipAddresses: 0,
      });

      // Verify warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { domain: 'example.com', error: 'DNS resolution failed' },
        'Failed to resolve A records'
      );

      // Verify no findings created
      expect(mockFindingModel.findOneAndUpdate).not.toHaveBeenCalled();

      // Verify asset updated with empty IPs
      expect(mockAssetModel.findByIdAndUpdate).toHaveBeenCalledWith('asset-123', {
        ip: [],
      });
    });

    it('should handle job processing errors', async () => {
      mockDnsPromises.resolve4.mockRejectedValue(new Error('Fatal DNS error'));
      mockJobModel.findOneAndUpdate.mockRejectedValueOnce(new Error('Database error'));

      await expect(processDNSJob(mockJob)).rejects.toThrow('Database error');

      // Verify error logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), jobId: 'job-123', domain: 'example.com' },
        'DNS job failed'
      );

      // Verify job marked as failed
      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        {
          status: 'failed',
          finishedAt: expect.any(Date),
          error: 'Database error'
        }
      );
    });

    it('should handle errors during subdomain discovery', async () => {
      mockDnsPromises.resolve4
        .mockResolvedValueOnce(['192.168.1.1']) // Main domain
        .mockRejectedValue(new Error('NXDOMAIN')); // All subdomains fail

      mockDnsPromises.resolve6.mockRejectedValue(new Error('No AAAA'));

      const result = await processDNSJob(mockJob);

      expect(result.foundSubdomains).toBe(0);

      // Verify all 8 common subdomains were checked
      const subdomains = ['www', 'mail', 'ftp', 'admin', 'api', 'dev', 'staging', 'test'];
      subdomains.forEach(sub => {
        expect(mockAssetModel.findOneAndUpdate).toHaveBeenCalledWith(
          { fqdn: `${sub}.example.com` },
          { active: false },
          { upsert: false }
        );
      });
    });

    it('should handle all subdomains being active', async () => {
      mockDnsPromises.resolve4.mockResolvedValue(['192.168.1.1']);
      mockDnsPromises.resolve6.mockRejectedValue(new Error('No AAAA'));

      const result = await processDNSJob(mockJob);

      expect(result.foundSubdomains).toBe(8);

      // Verify all subdomains created
      const subdomains = ['www', 'mail', 'ftp', 'admin', 'api', 'dev', 'staging', 'test'];
      subdomains.forEach(sub => {
        expect(mockAssetModel.findOneAndUpdate).toHaveBeenCalledWith(
          { fqdn: `${sub}.example.com` },
          {
            type: 'subdomain',
            fqdn: `${sub}.example.com`,
            parentFqdn: 'example.com',
            active: true,
            ip: ['192.168.1.1'],
          },
          { upsert: true, new: true }
        );
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { subdomain: 'www.example.com', ip: ['192.168.1.1'] },
        'Subdomain discovered'
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

      expect(Worker).toHaveBeenCalledWith('dns', expect.any(Function), {
        connection: mockRedis,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 60000,
        },
      });

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));

      expect(mockLogger.info).toHaveBeenCalledWith('Starting DNS worker...');
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to MongoDB');
      expect(mockLogger.info).toHaveBeenCalledWith('DNS worker started');
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

      expect(failedHandler).toBeDefined();

      const mockError = new Error('Job processing failed');
      failedHandler(null, mockError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: undefined, error: mockError },
        'Job failed'
      );
    });
  });
});


