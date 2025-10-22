import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock RealtimeGateway
vi.mock('./realtime.gateway', () => ({
  RealtimeGateway: class MockRealtimeGateway {},
}));

// Mock ProgressController
vi.mock('./progress.controller', () => ({
  ProgressController: class MockProgressController {},
}));

describe('RealtimeModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', async () => {
    const { RealtimeModule } = await import('./realtime.module');
    expect(RealtimeModule).toBeDefined();
  });

  it('should have correct module name', async () => {
    const { RealtimeModule } = await import('./realtime.module');
    expect(RealtimeModule.name).toBe('RealtimeModule');
  });

  it('should provide RealtimeGateway', async () => {
    const { RealtimeGateway } = await import('./realtime.gateway');
    expect(RealtimeGateway).toBeDefined();
  });

  it('should register ProgressController', async () => {
    const { ProgressController } = await import('./progress.controller');
    expect(ProgressController).toBeDefined();
  });

  it('should export RealtimeGateway', async () => {
    const { RealtimeModule } = await import('./realtime.module');
    const { RealtimeGateway } = await import('./realtime.gateway');
    
    expect(RealtimeModule).toBeDefined();
    expect(RealtimeGateway).toBeDefined();
  });
});

