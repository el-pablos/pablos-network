import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { Queue } from 'bullmq';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((name) => ({
    name,
    add: vi.fn().mockResolvedValue({ id: 'job-123', name: 'test-job' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 10,
      failed: 2,
    }),
  })),
}));

// Mock Redis
vi.mock('@pablos/utils', async () => {
  const actual = await vi.importActual('@pablos/utils');
  return {
    ...actual,
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
    },
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService],
    }).compile();

    service = module.get<QueueService>(QueueService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('onModuleInit', () => {
    it('should initialize all provider queues', async () => {
      expect(Queue).toHaveBeenCalled();
      
      // Should create queues for all providers
      const providers = [
        'dns',
        'zoomEye',
        'binaryEdge',
        'dirsearch',
        'zap',
        'reverseip',
        'domainwatch',
        'policy',
        'seo',
        'media',
      ];

      expect(Queue).toHaveBeenCalledTimes(providers.length);
    });
  });

  describe('addJob', () => {
    it('should add job to correct provider queue', async () => {
      const jobData = {
        targetRef: '507f1f77bcf86cd799439011',
        domain: 'example.com',
      };

      await service.addJob('dns', 'job-123', jobData);

      // Verify queue.add was called
      const mockQueue = (Queue as any).mock.results[0].value;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'job-123',
        jobData,
        expect.objectContaining({
          jobId: 'job-123',
        })
      );
    });

    it('should add job with metadata', async () => {
      const jobData = {
        targetRef: '507f1f77bcf86cd799439011',
        domain: 'example.com',
        metadata: {
          mode: 'safe',
          depth: 2,
        },
      };

      // Should not throw
      await expect(service.addJob('dirsearch', 'job-456', jobData)).resolves.toBeUndefined();
    });

    it('should throw error for invalid provider', async () => {
      await expect(
        service.addJob('invalid-provider' as any, 'job-123', {})
      ).rejects.toThrow();
    });
  });

  describe('getQueue', () => {
    it('should return queue for valid provider', () => {
      const queue = service.getQueue('dns');
      expect(queue).toBeDefined();
      expect(queue.name).toBe('dns');
    });

    it('should throw error for invalid provider', () => {
      expect(() => service.getQueue('invalid-provider' as any)).toThrow();
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const mockQueue = (Queue as any).mock.results[0].value;
      mockQueue.getJob = vi.fn().mockResolvedValue({
        id: 'job-123',
        name: 'test-job',
        data: { domain: 'example.com' },
        progress: vi.fn().mockResolvedValue(50),
        getState: vi.fn().mockResolvedValue('active'),
        attemptsMade: 1,
        failedReason: null,
        finishedOn: null,
        processedOn: Date.now(),
      });

      const status = await service.getJobStatus('dns', 'job-123');

      expect(status).toBeDefined();
      expect(status.id).toBe('job-123');
      expect(status.state).toBe('active');
    });

    it('should return null for non-existent job', async () => {
      const mockQueue = (Queue as any).mock.results[0].value;
      mockQueue.getJob = vi.fn().mockResolvedValue(null);

      const status = await service.getJobStatus('dns', 'nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel job by ID', async () => {
      const mockQueue = (Queue as any).mock.results[0].value;
      mockQueue.getJob = vi.fn().mockResolvedValue({
        id: 'job-123',
        remove: vi.fn().mockResolvedValue(undefined),
      });

      await service.cancelJob('dns', 'job-123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
    });

    it('should not throw error for non-existent job', async () => {
      const mockQueue = (Queue as any).mock.results[0].value;
      mockQueue.getJob = vi.fn().mockResolvedValue(null);

      // Should not throw - just silently skip
      await service.cancelJob('dns', 'nonexistent');

      expect(mockQueue.getJob).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all queues on shutdown', async () => {
      await service.onModuleDestroy();

      const mockQueue = (Queue as any).mock.results[0].value;
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});

