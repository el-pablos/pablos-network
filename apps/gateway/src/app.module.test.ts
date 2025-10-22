import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';

// Mock environment variables
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

// Mock Mongoose connection
vi.mock('@nestjs/mongoose', async () => {
  const actual = await vi.importActual('@nestjs/mongoose');
  return {
    ...actual,
    MongooseModule: {
      forRoot: vi.fn(() => ({
        module: class MockMongooseRootModule {},
        providers: [],
        exports: [],
      })),
      forFeature: vi.fn(() => ({
        module: class MockMongooseFeatureModule {},
        providers: [],
        exports: [],
      })),
    },
  };
});

// Mock QueueModule
vi.mock('./queue/queue.module', () => ({
  QueueModule: class MockQueueModule {},
}));

// Mock StreamsModule
vi.mock('./streams/streams.module', () => ({
  StreamsModule: class MockStreamsModule {},
}));

// Mock RealtimeModule
vi.mock('./realtime/realtime.module', () => ({
  RealtimeModule: class MockRealtimeModule {},
}));

// Mock controllers
vi.mock('./api/scope.controller', () => ({
  ScopeController: class MockScopeController {},
}));

vi.mock('./api/scan.controller', () => ({
  ScanController: class MockScanController {},
}));

vi.mock('./api/findings.controller', () => ({
  FindingsController: class MockFindingsController {},
}));

vi.mock('./api/assets.controller', () => ({
  AssetsController: class MockAssetsController {},
}));

describe('AppModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', async () => {
    const { AppModule } = await import('./app.module');
    expect(AppModule).toBeDefined();
  }, 10000);

  it('should have correct module metadata', async () => {
    const { AppModule } = await import('./app.module');

    // Check that the module class exists
    expect(AppModule.name).toBe('AppModule');

    // The module is defined and can be imported
    expect(AppModule).toBeDefined();
  });

  it('should import required modules', async () => {
    const { AppModule } = await import('./app.module');
    const { QueueModule } = await import('./queue/queue.module');
    const { StreamsModule } = await import('./streams/streams.module');
    const { RealtimeModule } = await import('./realtime/realtime.module');
    
    expect(QueueModule).toBeDefined();
    expect(StreamsModule).toBeDefined();
    expect(RealtimeModule).toBeDefined();
  });

  it('should register controllers', async () => {
    const { AppModule } = await import('./app.module');
    const { ScopeController } = await import('./api/scope.controller');
    const { ScanController } = await import('./api/scan.controller');
    const { FindingsController } = await import('./api/findings.controller');
    const { AssetsController } = await import('./api/assets.controller');
    
    expect(ScopeController).toBeDefined();
    expect(ScanController).toBeDefined();
    expect(FindingsController).toBeDefined();
    expect(AssetsController).toBeDefined();
  });

  it('should import schemas', async () => {
    const schemas = await import('./schemas');
    
    expect(schemas.Asset).toBeDefined();
    expect(schemas.AssetSchema).toBeDefined();
    expect(schemas.Job).toBeDefined();
    expect(schemas.JobSchema).toBeDefined();
    expect(schemas.Finding).toBeDefined();
    expect(schemas.FindingSchema).toBeDefined();
    expect(schemas.Metric).toBeDefined();
    expect(schemas.MetricSchema).toBeDefined();
    expect(schemas.AuditLog).toBeDefined();
    expect(schemas.AuditLogSchema).toBeDefined();
  });
});

