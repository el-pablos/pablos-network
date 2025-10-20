import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { StreamsService } from './streams.service';
import { EventEmitter } from 'events';

// Mock logger
vi.mock('@pablos/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('StreamsService', () => {
  let service: StreamsService;
  let mockJobsStream: EventEmitter;
  let mockFindingsStream: EventEmitter;
  let mockConnection: any;

  beforeEach(async () => {
    // Create mock change streams
    mockJobsStream = new EventEmitter();
    (mockJobsStream as any).close = vi.fn().mockResolvedValue(undefined);

    mockFindingsStream = new EventEmitter();
    (mockFindingsStream as any).close = vi.fn().mockResolvedValue(undefined);

    // Mock MongoDB connection
    mockConnection = {
      collection: vi.fn((name: string) => ({
        watch: vi.fn(() => {
          if (name === 'jobs') return mockJobsStream;
          if (name === 'findings') return mockFindingsStream;
          return new EventEmitter();
        }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamsService,
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<StreamsService>(StreamsService);
  });

  describe('onModuleInit', () => {
    it('should initialize change streams for jobs and findings', async () => {
      await service.onModuleInit();

      expect(mockConnection.collection).toHaveBeenCalledWith('jobs');
      expect(mockConnection.collection).toHaveBeenCalledWith('findings');
    });

    it('should emit job:change event when jobs stream emits change', async () => {
      await service.onModuleInit();

      const changeEvent = {
        operationType: 'insert' as const,
        documentKey: { _id: 'job-123' },
        fullDocument: { id: 'job-123', status: 'running' },
      };

      const emitSpy = vi.fn();
      service.on('job:change', emitSpy);

      mockJobsStream.emit('change', changeEvent);

      expect(emitSpy).toHaveBeenCalledWith(changeEvent);
    });

    it('should emit finding:change event when findings stream emits change', async () => {
      await service.onModuleInit();

      const changeEvent = {
        operationType: 'insert' as const,
        documentKey: { _id: 'finding-123' },
        fullDocument: { id: 'finding-123', severity: 'HIGH' },
      };

      const emitSpy = vi.fn();
      service.on('finding:change', emitSpy);

      mockFindingsStream.emit('change', changeEvent);

      expect(emitSpy).toHaveBeenCalledWith(changeEvent);
    });

    it('should handle jobs stream errors', async () => {
      await service.onModuleInit();

      const error = new Error('Jobs stream error');
      
      // Should not throw
      expect(() => {
        mockJobsStream.emit('error', error);
      }).not.toThrow();
    });

    it('should handle findings stream errors', async () => {
      await service.onModuleInit();

      const error = new Error('Findings stream error');
      
      // Should not throw
      expect(() => {
        mockFindingsStream.emit('error', error);
      }).not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock connection to throw error
      mockConnection.collection = vi.fn(() => {
        throw new Error('Replica set not configured');
      });

      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should emit update event for jobs', async () => {
      await service.onModuleInit();

      const changeEvent = {
        operationType: 'update' as const,
        documentKey: { _id: 'job-456' },
        fullDocument: { id: 'job-456', status: 'completed' },
        updateDescription: { updatedFields: { status: 'completed' } },
      };

      const emitSpy = vi.fn();
      service.on('job:change', emitSpy);

      mockJobsStream.emit('change', changeEvent);

      expect(emitSpy).toHaveBeenCalledWith(changeEvent);
    });

    it('should emit delete event for findings', async () => {
      await service.onModuleInit();

      const changeEvent = {
        operationType: 'delete' as const,
        documentKey: { _id: 'finding-789' },
      };

      const emitSpy = vi.fn();
      service.on('finding:change', emitSpy);

      mockFindingsStream.emit('change', changeEvent);

      expect(emitSpy).toHaveBeenCalledWith(changeEvent);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close both change streams', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockJobsStream.close).toHaveBeenCalled();
      expect(mockFindingsStream.close).toHaveBeenCalled();
    });

    it('should handle missing streams gracefully', async () => {
      // Don't initialize streams
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should close only jobs stream if findings stream is missing', async () => {
      // Manually set only jobs stream
      (service as any).jobsStream = mockJobsStream;
      (service as any).findingsStream = undefined;

      await service.onModuleDestroy();

      expect(mockJobsStream.close).toHaveBeenCalled();
    });

    it('should close only findings stream if jobs stream is missing', async () => {
      // Manually set only findings stream
      (service as any).jobsStream = undefined;
      (service as any).findingsStream = mockFindingsStream;

      await service.onModuleDestroy();

      expect(mockFindingsStream.close).toHaveBeenCalled();
    });
  });
});

