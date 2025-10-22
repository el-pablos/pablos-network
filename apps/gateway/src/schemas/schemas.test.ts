import { describe, it, expect } from 'vitest';

describe('Gateway Schemas', () => {
  it('should import asset schema', async () => {
    const { AssetSchema, Asset } = await import('./asset.schema');
    expect(AssetSchema).toBeDefined();
    expect(Asset).toBeDefined();
  }, 10000);

  it('should import finding schema', async () => {
    const { FindingSchema, Finding } = await import('./finding.schema');
    expect(FindingSchema).toBeDefined();
    expect(Finding).toBeDefined();
  });

  it('should import job schema', async () => {
    const { JobSchema, Job } = await import('./job.schema');
    expect(JobSchema).toBeDefined();
    expect(Job).toBeDefined();
  });

  it('should import metric schema', async () => {
    const { MetricSchema, Metric } = await import('./metric.schema');
    expect(MetricSchema).toBeDefined();
    expect(Metric).toBeDefined();
  });

  it('should export all schemas from index', async () => {
    const schemas = await import('./index');

    expect(schemas.AssetSchema).toBeDefined();
    expect(schemas.FindingSchema).toBeDefined();
    expect(schemas.JobSchema).toBeDefined();
    expect(schemas.MetricSchema).toBeDefined();
  });
});

