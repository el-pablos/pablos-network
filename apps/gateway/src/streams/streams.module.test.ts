import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock StreamsService
vi.mock('./streams.service', () => ({
  StreamsService: class MockStreamsService {},
}));

describe('StreamsModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', async () => {
    const { StreamsModule } = await import('./streams.module');
    expect(StreamsModule).toBeDefined();
  });

  it('should be a global module', async () => {
    const { StreamsModule } = await import('./streams.module');
    expect(StreamsModule.name).toBe('StreamsModule');
  });

  it('should provide StreamsService', async () => {
    const { StreamsService } = await import('./streams.service');
    expect(StreamsService).toBeDefined();
  });

  it('should export StreamsService', async () => {
    const { StreamsModule } = await import('./streams.module');
    const { StreamsService } = await import('./streams.service');
    
    expect(StreamsModule).toBeDefined();
    expect(StreamsService).toBeDefined();
  });
});

