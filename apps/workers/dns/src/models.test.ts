import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mongoose before importing models
vi.mock('mongoose', () => {
  const Schema = vi.fn(function(this: any, definition: any, options?: any) {
    this.definition = definition;
    this.options = options;
    this.index = vi.fn();
    return this;
  });
  
  (Schema as any).Types = {
    ObjectId: 'ObjectId',
    Mixed: 'Mixed',
  };

  const model = vi.fn((name: string, schema: any) => {
    return {
      modelName: name,
      schema,
    };
  });

  return {
    Schema,
    model,
  };
});

describe('DNS Worker Models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export Asset model', async () => {
    const { Asset } = await import('./models');
    expect(Asset).toBeDefined();
    expect(Asset.modelName).toBe('Asset');
  });

  it('should export Finding model', async () => {
    const { Finding } = await import('./models');
    expect(Finding).toBeDefined();
    expect(Finding.modelName).toBe('Finding');
  });

  it('should export Job model', async () => {
    const { Job } = await import('./models');
    expect(Job).toBeDefined();
    expect(Job.modelName).toBe('Job');
  });

  it('should export Metric model', async () => {
    const { Metric } = await import('./models');
    expect(Metric).toBeDefined();
    expect(Metric.modelName).toBe('Metric');
  });

  it('should create Asset schema with correct fields', async () => {
    vi.resetModules();
    const { Asset } = await import('./models');
    
    expect(Asset.schema).toBeDefined();
    expect(Asset.schema.definition).toBeDefined();
    expect(Asset.schema.definition.type).toEqual({ type: String, required: true });
    expect(Asset.schema.definition.fqdn).toBe(String);
    expect(Asset.schema.definition.active).toEqual({ type: Boolean, default: true });
    expect(Asset.schema.options).toEqual({ timestamps: true });
  });

  it('should create Finding schema with correct fields and index', async () => {
    vi.resetModules();
    const { Finding } = await import('./models');
    
    expect(Finding.schema).toBeDefined();
    expect(Finding.schema.definition).toBeDefined();
    expect(Finding.schema.definition.targetRef).toEqual({ type: 'ObjectId', required: true });
    expect(Finding.schema.definition.provider).toEqual({ type: String, required: true });
    expect(Finding.schema.definition.category).toEqual({ type: String, required: true });
    expect(Finding.schema.definition.fingerprint).toEqual({ type: String, required: true });
    
    // Check that index was created
    expect(Finding.schema.index).toHaveBeenCalledWith(
      { targetRef: 1, provider: 1, fingerprint: 1 },
      { unique: true }
    );
  });

  it('should create Job schema with correct fields', async () => {
    vi.resetModules();
    const { Job } = await import('./models');
    
    expect(Job.schema).toBeDefined();
    expect(Job.schema.definition).toBeDefined();
    expect(Job.schema.definition.jobId).toEqual({ type: String, required: true, unique: true });
    expect(Job.schema.definition.type).toEqual({ type: String, required: true });
    expect(Job.schema.definition.status).toEqual({ type: String, required: true });
    expect(Job.schema.definition.progress).toEqual({ type: Number, default: 0 });
  });

  it('should create Metric schema with correct fields', async () => {
    vi.resetModules();
    const { Metric } = await import('./models');
    
    expect(Metric.schema).toBeDefined();
    expect(Metric.schema.definition).toBeDefined();
    expect(Metric.schema.definition.ts).toEqual({ type: Date, required: true });
    expect(Metric.schema.definition.entity).toBeDefined();
    expect(Metric.schema.definition.name).toEqual({ type: String, required: true });
    expect(Metric.schema.definition.value).toEqual({ type: Number, required: true });
  });
});

