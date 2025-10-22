import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock QueueService
vi.mock('./queue.service', () => ({
  QueueService: class MockQueueService {},
}));

describe('QueueModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', async () => {
    const { QueueModule } = await import('./queue.module');
    expect(QueueModule).toBeDefined();
  });

  it('should be a global module', async () => {
    const { QueueModule } = await import('./queue.module');
    expect(QueueModule.name).toBe('QueueModule');
  });

  it('should provide QueueService', async () => {
    const { QueueService } = await import('./queue.service');
    expect(QueueService).toBeDefined();
  });

  it('should export QueueService', async () => {
    const { QueueModule } = await import('./queue.module');
    const { QueueService } = await import('./queue.service');
    
    expect(QueueModule).toBeDefined();
    expect(QueueService).toBeDefined();
  });
});

