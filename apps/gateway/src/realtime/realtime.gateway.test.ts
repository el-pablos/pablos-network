import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { StreamsService } from '../streams/streams.service';
import { QueueService } from '../queue/queue.service';
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

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let mockStreamsService: StreamsService;
  let mockQueueService: any;
  let mockServer: any;
  let mockClient: any;

  beforeEach(async () => {
    // Mock StreamsService (extends EventEmitter)
    mockStreamsService = Object.assign(new EventEmitter(), {
      on: EventEmitter.prototype.on,
      emit: EventEmitter.prototype.emit,
      listenerCount: EventEmitter.prototype.listenerCount,
    }) as any;

    // Mock QueueService
    mockQueueService = {
      cancelJob: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Socket.IO Server
    mockServer = {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    };

    // Mock Socket.IO Client
    mockClient = {
      id: 'client-123',
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: StreamsService,
          useValue: mockStreamsService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    gateway.server = mockServer;

    // Manually inject dependencies (NestJS DI might not work properly in tests)
    (gateway as any).streamsService = mockStreamsService;
    (gateway as any).queueService = mockQueueService;
  });

  describe('afterInit', () => {
    it('should setup change stream listeners', () => {
      gateway.afterInit(mockServer);

      // Verify listeners are registered
      expect(mockStreamsService.listenerCount('job:change')).toBe(1);
      expect(mockStreamsService.listenerCount('finding:change')).toBe(1);
    });

    it('should broadcast job:update when job:change event is emitted with fullDocument', () => {
      gateway.afterInit(mockServer);

      const jobChange = {
        operationType: 'update',
        documentKey: { _id: 'job-123' },
        fullDocument: { id: 'job-123', status: 'completed' },
      };

      mockStreamsService.emit('job:change', jobChange);

      expect(mockServer.emit).toHaveBeenCalledWith('job:update', jobChange.fullDocument);
    });

    it('should not broadcast job:update when job:change event has no fullDocument', () => {
      gateway.afterInit(mockServer);

      const jobChange = {
        operationType: 'delete',
        documentKey: { _id: 'job-123' },
      };

      mockStreamsService.emit('job:change', jobChange);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should broadcast finding:new when finding:change event is insert with fullDocument', () => {
      gateway.afterInit(mockServer);

      const findingChange = {
        operationType: 'insert',
        documentKey: { _id: 'finding-123' },
        fullDocument: { id: 'finding-123', severity: 'HIGH' },
      };

      mockStreamsService.emit('finding:change', findingChange);

      expect(mockServer.emit).toHaveBeenCalledWith('finding:new', findingChange.fullDocument);
    });

    it('should not broadcast finding:new when finding:change event is update', () => {
      gateway.afterInit(mockServer);

      const findingChange = {
        operationType: 'update',
        documentKey: { _id: 'finding-123' },
        fullDocument: { id: 'finding-123', severity: 'HIGH' },
      };

      mockStreamsService.emit('finding:change', findingChange);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('should not broadcast finding:new when finding:change event has no fullDocument', () => {
      gateway.afterInit(mockServer);

      const findingChange = {
        operationType: 'insert',
        documentKey: { _id: 'finding-123' },
      };

      mockStreamsService.emit('finding:change', findingChange);

      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      // Should not throw
      expect(() => {
        gateway.handleConnection(mockClient);
      }).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      // Should not throw
      expect(() => {
        gateway.handleDisconnect(mockClient);
      }).not.toThrow();
    });
  });

  describe('handleJobCancel', () => {
    it('should cancel job and emit job:cancelled event', async () => {
      const payload = { jobId: 'job-123', provider: 'webdiscovery' };

      const result = await gateway.handleJobCancel(mockClient, payload);

      expect(mockQueueService.cancelJob).toHaveBeenCalledWith('webdiscovery', 'job-123');
      expect(mockClient.emit).toHaveBeenCalledWith('job:cancelled', { jobId: 'job-123' });
    });

    it('should emit error event when job cancellation fails', async () => {
      const payload = { jobId: 'job-456', provider: 'origin' };
      const error = new Error('Job not found');
      mockQueueService.cancelJob.mockRejectedValueOnce(error);

      const result = await gateway.handleJobCancel(mockClient, payload);

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Failed to cancel job' });
    });
  });

  describe('handleSubscribeJob', () => {
    it('should join client to job room', () => {
      const payload = { jobId: 'job-789' };

      gateway.handleSubscribeJob(mockClient, payload);

      expect(mockClient.join).toHaveBeenCalledWith('job:job-789');
    });
  });

  describe('handleUnsubscribeJob', () => {
    it('should remove client from job room', () => {
      const payload = { jobId: 'job-789' };

      gateway.handleUnsubscribeJob(mockClient, payload);

      expect(mockClient.leave).toHaveBeenCalledWith('job:job-789');
    });
  });

  describe('emitJobLog', () => {
    it('should emit log to specific job room', () => {
      const jobId = 'job-999';
      const log = 'Processing target...';

      gateway.emitJobLog(jobId, log);

      expect(mockServer.to).toHaveBeenCalledWith('job:job-999');
      expect(mockServer.emit).toHaveBeenCalledWith('job:log', {
        jobId,
        log,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('broadcastJobUpdate', () => {
    it('should broadcast job update to all clients', () => {
      const job = { id: 'job-111', status: 'running', progress: 50 };

      gateway.broadcastJobUpdate(job);

      expect(mockServer.emit).toHaveBeenCalledWith('job:update', job);
    });
  });

  describe('broadcastFinding', () => {
    it('should broadcast new finding to all clients', () => {
      const finding = { id: 'finding-222', severity: 'CRITICAL', title: 'SQL Injection' };

      gateway.broadcastFinding(finding);

      expect(mockServer.emit).toHaveBeenCalledWith('finding:new', finding);
    });
  });
});

