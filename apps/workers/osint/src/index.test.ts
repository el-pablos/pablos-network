import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock BullMQ
const mockZoomEyeWorker = { on: vi.fn() };
const mockBinaryEdgeWorker = { on: vi.fn() };
let workerCallCount = 0;

vi.mock('bullmq', () => ({
  Worker: vi.fn((queueName: string) => {
    if (queueName === 'zoomEye') return mockZoomEyeWorker;
    if (queueName === 'binaryEdge') return mockBinaryEdgeWorker;
    return { on: vi.fn() };
  }),
}));

// Mock mongoose
const mockJobModel = {
  findOneAndUpdate: vi.fn(),
};

const mockFindingModel = {
  findOneAndUpdate: vi.fn(),
};

const mockAssetModel = {};

vi.mock('mongoose', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  model: vi.fn((name: string) => {
    if (name === 'Job') return mockJobModel;
    if (name === 'Finding') return mockFindingModel;
    if (name === 'Asset') return mockAssetModel;
    return {};
  }),
  Schema: vi.fn(),
}));

// Mock HttpClient
class MockHttpClient {
  constructor(public baseURL: string, public options?: any) {}
  async get(url: string) {
    return mockHttpGet(url);
  }
}

const mockHttpGet = vi.fn();

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
  HttpClient: MockHttpClient,
  generateFingerprint: vi.fn((data: any) => `fingerprint-${JSON.stringify(data)}`),
}));

// Mock models
vi.mock('./models', () => ({
  Asset: mockAssetModel,
  Finding: mockFindingModel,
  Job: mockJobModel,
}));

describe('OSINT Worker', () => {
  let processZoomEyeJob: any;
  let processBinaryEdgeJob: any;
  let mockJob: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('ZOOMEYE_API_KEY', 'test-zoomeye-key');
    vi.stubEnv('BINARYEDGE_API_KEY', 'test-binaryedge-key');

    mockJobModel.findOneAndUpdate.mockResolvedValue({});
    mockFindingModel.findOneAndUpdate.mockResolvedValue({});
    mockHttpGet.mockResolvedValue({ matches: [] });

    mockJob = {
      id: 'job-123',
      data: {
        assetId: 'asset-123',
        domain: 'example.com',
      },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };

    // Import module to get job processors
    vi.resetModules();
    const module = await import('./index');
    
    const { Worker } = await import('bullmq');
    const workerCalls = vi.mocked(Worker).mock.calls;
    
    // Find ZoomEye and BinaryEdge processors
    const zoomEyeCall = workerCalls.find(call => call[0] === 'zoomEye');
    const binaryEdgeCall = workerCalls.find(call => call[0] === 'binaryEdge');
    
    if (zoomEyeCall) processZoomEyeJob = zoomEyeCall[1];
    if (binaryEdgeCall) processBinaryEdgeJob = binaryEdgeCall[1];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('processZoomEyeJob', () => {
    it('should process ZoomEye job successfully with results', async () => {
      mockHttpGet.mockResolvedValueOnce({
        matches: [
          {
            ip: '192.168.1.1',
            portinfo: { port: 80, service: 'http' },
          },
          {
            ip: '192.168.1.2',
            portinfo: { port: 443, service: 'https' },
          },
        ],
      });

      const result = await processZoomEyeJob(mockJob);

      expect(result).toEqual({
        success: true,
        results: 2,
      });

      // Verify job status updates
      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'running', startedAt: expect.any(Date), progress: 10 }
      );

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'done', finishedAt: expect.any(Date), progress: 100, message: 'Found 2 results' }
      );

      // Verify API call
      expect(mockHttpGet).toHaveBeenCalledWith('/host/search?query=hostname:example.com&page=1');

      // Verify findings created
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          targetRef: 'asset-123',
          provider: 'zoomEye',
          fingerprint: expect.any(String),
        },
        {
          targetRef: 'asset-123',
          targetFqdn: 'example.com',
          provider: 'zoomEye',
          category: 'OSINT',
          title: 'Open Port 80 on 192.168.1.1',
          description: 'Service: http',
          severity: 'info',
          fingerprint: expect.any(String),
          metadata: { ip: '192.168.1.1', port: 80, service: 'http' },
        },
        { upsert: true, new: true }
      );

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle more than 10 results (limit to 10)', async () => {
      const matches = Array.from({ length: 15 }, (_, i) => ({
        ip: `192.168.1.${i}`,
        portinfo: { port: 80 + i, service: 'http' },
      }));

      mockHttpGet.mockResolvedValueOnce({ matches });

      const result = await processZoomEyeJob(mockJob);

      expect(result).toEqual({
        success: true,
        results: 15,
      });

      // Verify only 10 findings created
      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledTimes(10);

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'done', finishedAt: expect.any(Date), progress: 100, message: 'Found 15 results' }
      );
    });

    it('should handle results without portinfo', async () => {
      mockHttpGet.mockResolvedValueOnce({
        matches: [
          {
            ip: '192.168.1.1',
            portinfo: null,
          },
        ],
      });

      const result = await processZoomEyeJob(mockJob);

      expect(result.success).toBe(true);

      expect(mockFindingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: 'Open Port undefined on 192.168.1.1',
          description: 'Service: unknown',
          metadata: { ip: '192.168.1.1', port: undefined, service: undefined },
        }),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      mockHttpGet.mockResolvedValueOnce({ matches: [] });

      const result = await processZoomEyeJob(mockJob);

      expect(result).toEqual({
        success: true,
        results: 0,
      });

      expect(mockFindingModel.findOneAndUpdate).not.toHaveBeenCalled();

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'done', finishedAt: expect.any(Date), progress: 100, message: 'Found 0 results' }
      );
    });

    it('should handle missing matches field', async () => {
      mockHttpGet.mockResolvedValueOnce({});

      const result = await processZoomEyeJob(mockJob);

      expect(result).toEqual({
        success: true,
        results: 0,
      });

      expect(mockFindingModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should skip when API key is not configured', async () => {
      vi.stubEnv('ZOOMEYE_API_KEY', '');

      const result = await processZoomEyeJob(mockJob);

      expect(result).toEqual({ skipped: true });

      expect(mockLogger.warn).toHaveBeenCalledWith('ZOOMEYE_API_KEY not configured, skipping');
      expect(mockHttpGet).not.toHaveBeenCalled();
      expect(mockJobModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockHttpGet.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await expect(processZoomEyeJob(mockJob)).rejects.toThrow('API rate limit exceeded');

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: expect.any(Error), jobId: 'job-123', domain: 'example.com' },
        'ZoomEye job failed'
      );

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'failed', finishedAt: expect.any(Date), error: 'API rate limit exceeded' }
      );
    });

    it('should handle database errors during job update', async () => {
      mockJobModel.findOneAndUpdate.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(processZoomEyeJob(mockJob)).rejects.toThrow('Database connection lost');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processBinaryEdgeJob', () => {
    it('should process BinaryEdge job (stub implementation)', async () => {
      const result = await processBinaryEdgeJob(mockJob);

      expect(result).toEqual({
        success: true,
        stub: true,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { jobId: 'job-123', domain: 'example.com' },
        'Processing BinaryEdge job'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        'BinaryEdge worker stub - implement API integration'
      );

      expect(mockJobModel.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: 'job-123' },
        { status: 'done', finishedAt: expect.any(Date), progress: 100, message: 'Stub implementation' }
      );
    });

    it('should skip when API key is not configured', async () => {
      vi.stubEnv('BINARYEDGE_API_KEY', '');

      const result = await processBinaryEdgeJob(mockJob);

      expect(result).toEqual({ skipped: true });

      expect(mockLogger.warn).toHaveBeenCalledWith('BINARYEDGE_API_KEY not configured, skipping');
    });
  });

  describe('Worker initialization', () => {
    it('should start both workers and connect to MongoDB', async () => {
      const { connect } = await import('mongoose');
      const { Worker } = await import('bullmq');

      expect(connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', {
        dbName: 'pablos-network',
      });

      // Verify ZoomEye worker created
      expect(Worker).toHaveBeenCalledWith('zoomEye', expect.any(Function), {
        connection: mockRedis,
        concurrency: 2,
        limiter: { max: 5, duration: 60000 },
      });

      // Verify BinaryEdge worker created
      expect(Worker).toHaveBeenCalledWith('binaryEdge', expect.any(Function), {
        connection: mockRedis,
        concurrency: 2,
        limiter: { max: 5, duration: 60000 },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Starting OSINT workers...');
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to MongoDB');
      expect(mockLogger.info).toHaveBeenCalledWith('OSINT workers started');
    });
  });
});

