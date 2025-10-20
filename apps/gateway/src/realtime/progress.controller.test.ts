import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { Metric } from '../schemas';
import { EventEmitter } from 'events';

describe('ProgressController', () => {
  let controller: ProgressController;
  let mockMetricModel: any;

  beforeEach(async () => {
    mockMetricModel = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        {
          provide: getModelToken(Metric.name),
          useValue: mockMetricModel,
        },
      ],
    }).compile();

    controller = module.get<ProgressController>(ProgressController);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('streamProgress', () => {
    it('should send initial connection event', async () => {
      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      mockMetricModel.lean.mockResolvedValue([]);

      // Start streaming (don't await, it runs indefinitely)
      const streamPromise = controller.streamProgress('job-123', mockReply);

      // Wait a bit for initial setup
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRaw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      expect(mockRaw.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ type: 'connected' })}\n\n`
      );

      // Cleanup
      mockRaw.emit('close');
    });

    it('should stream progress updates every 2 seconds', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      const mockMetric = {
        value: 50,
        ts: new Date('2024-01-01T10:00:00Z'),
      };

      mockMetricModel.lean.mockResolvedValue([mockMetric]);

      // Start streaming
      controller.streamProgress('job-123', mockReply);

      // Initial connection event
      expect(mockRaw.write).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should have sent progress update
      expect(mockMetricModel.find).toHaveBeenCalledWith({
        'entity.kind': 'job',
        'entity.id': 'job-123',
        name: 'progress',
      });

      expect(mockRaw.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({
          type: 'progress',
          jobId: 'job-123',
          value: 50,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        })}\n\n`
      );

      // Cleanup
      mockRaw.emit('close');
      vi.useRealTimers();
    });

    it('should not send progress when no metrics found', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      mockMetricModel.lean.mockResolvedValue([]);

      // Start streaming
      controller.streamProgress('job-123', mockReply);

      // Initial connection event
      expect(mockRaw.write).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should still only have initial connection event (no progress update)
      expect(mockRaw.write).toHaveBeenCalledTimes(1);

      // Cleanup
      mockRaw.emit('close');
      vi.useRealTimers();
    });

    it('should not query metrics when jobId is missing', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      // Start streaming without jobId
      controller.streamProgress('', mockReply);

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have queried metrics
      expect(mockMetricModel.find).not.toHaveBeenCalled();

      // Cleanup
      mockRaw.emit('close');
      vi.useRealTimers();
    });

    it('should handle errors gracefully', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      mockMetricModel.lean.mockRejectedValue(new Error('Database error'));

      // Start streaming
      controller.streamProgress('job-123', mockReply);

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should have attempted to query metrics
      expect(mockMetricModel.find).toHaveBeenCalled();

      // Should not crash (error is logged but not thrown)
      expect(mockRaw.write).toHaveBeenCalledTimes(1); // Only initial connection event

      // Cleanup
      mockRaw.emit('close');
      vi.useRealTimers();
    });

    it('should cleanup interval on client disconnect', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      mockMetricModel.lean.mockResolvedValue([{ value: 50, ts: new Date() }]);

      // Start streaming
      controller.streamProgress('job-123', mockReply);

      // Advance time by 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should have sent progress update
      expect(mockMetricModel.find).toHaveBeenCalledTimes(1);

      // Client disconnects
      mockRaw.emit('close');

      // Advance time by another 2 seconds
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have queried metrics again (interval cleared)
      expect(mockMetricModel.find).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should send multiple progress updates over time', async () => {
      vi.useFakeTimers();

      const mockRaw = new EventEmitter() as any;
      mockRaw.writeHead = vi.fn();
      mockRaw.write = vi.fn();

      const mockReply = {
        raw: mockRaw,
      } as any;

      const mockMetrics = [
        { value: 25, ts: new Date('2024-01-01T10:00:00Z') },
        { value: 50, ts: new Date('2024-01-01T10:00:02Z') },
        { value: 75, ts: new Date('2024-01-01T10:00:04Z') },
      ];

      let callCount = 0;
      mockMetricModel.lean.mockImplementation(() => {
        const metric = mockMetrics[callCount] || mockMetrics[mockMetrics.length - 1];
        callCount++;
        return Promise.resolve([metric]);
      });

      // Start streaming
      controller.streamProgress('job-123', mockReply);

      // Initial connection event
      expect(mockRaw.write).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds (first update)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockRaw.write).toHaveBeenCalledTimes(2);

      // Advance time by 2 seconds (second update)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockRaw.write).toHaveBeenCalledTimes(3);

      // Advance time by 2 seconds (third update)
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockRaw.write).toHaveBeenCalledTimes(4);

      // Cleanup
      mockRaw.emit('close');
      vi.useRealTimers();
    });
  });
});

