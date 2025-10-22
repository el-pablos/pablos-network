import { describe, it, expect } from 'vitest';

describe('Gateway Schemas', () => {
  describe('Asset Schema', () => {
    it('should create asset schema with correct properties', async () => {
      const { Asset, AssetSchema } = await import('./asset.schema');

      expect(AssetSchema).toBeDefined();
      expect(Asset).toBeDefined();
      expect(Asset.name).toBe('Asset');

      // Test schema paths
      expect(AssetSchema.path('type')).toBeDefined();
      expect(AssetSchema.path('fqdn')).toBeDefined();
      expect(AssetSchema.path('parentFqdn')).toBeDefined();
      expect(AssetSchema.path('active')).toBeDefined();
      expect(AssetSchema.path('ip')).toBeDefined();
      expect(AssetSchema.path('owner')).toBeDefined();
      expect(AssetSchema.path('verifiedAt')).toBeDefined();
      expect(AssetSchema.path('consentToken')).toBeDefined();
      expect(AssetSchema.path('metadata')).toBeDefined();
    }, 10000);

    it('should have correct indexes', async () => {
      const { AssetSchema } = await import('./asset.schema');

      const indexes = AssetSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Finding Schema', () => {
    it('should create finding schema with correct properties', async () => {
      const { Finding, FindingSchema } = await import('./finding.schema');

      expect(FindingSchema).toBeDefined();
      expect(Finding).toBeDefined();
      expect(Finding.name).toBe('Finding');

      // Test schema paths
      expect(FindingSchema.path('targetRef')).toBeDefined();
      expect(FindingSchema.path('targetFqdn')).toBeDefined();
      expect(FindingSchema.path('provider')).toBeDefined();
      expect(FindingSchema.path('category')).toBeDefined();
      expect(FindingSchema.path('title')).toBeDefined();
      expect(FindingSchema.path('description')).toBeDefined();
      expect(FindingSchema.path('severity')).toBeDefined();
      expect(FindingSchema.path('fingerprint')).toBeDefined();
      expect(FindingSchema.path('metadata')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { FindingSchema } = await import('./finding.schema');

      const indexes = FindingSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Job Schema', () => {
    it('should create job schema with correct properties', async () => {
      const { Job, JobSchema } = await import('./job.schema');

      expect(JobSchema).toBeDefined();
      expect(Job).toBeDefined();
      expect(Job.name).toBe('Job');

      // Test schema paths
      expect(JobSchema.path('jobId')).toBeDefined();
      expect(JobSchema.path('targetRef')).toBeDefined();
      expect(JobSchema.path('targetFqdn')).toBeDefined();
      expect(JobSchema.path('type')).toBeDefined();
      expect(JobSchema.path('status')).toBeDefined();
      expect(JobSchema.path('progress')).toBeDefined();
      expect(JobSchema.path('message')).toBeDefined();
      expect(JobSchema.path('startedAt')).toBeDefined();
      expect(JobSchema.path('finishedAt')).toBeDefined();
      expect(JobSchema.path('error')).toBeDefined();
      expect(JobSchema.path('metadata')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { JobSchema } = await import('./job.schema');

      const indexes = JobSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Metric Schema', () => {
    it('should create metric schema with correct properties', async () => {
      const { Metric, MetricSchema } = await import('./metric.schema');

      expect(MetricSchema).toBeDefined();
      expect(Metric).toBeDefined();
      expect(Metric.name).toBe('Metric');

      // Test schema paths
      expect(MetricSchema.path('ts')).toBeDefined();
      expect(MetricSchema.path('entity')).toBeDefined();
      expect(MetricSchema.path('name')).toBeDefined();
      expect(MetricSchema.path('value')).toBeDefined();
      expect(MetricSchema.path('unit')).toBeDefined();
      expect(MetricSchema.path('metadata')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { MetricSchema } = await import('./metric.schema');

      const indexes = MetricSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Schema', () => {
    it('should create audit schema with correct properties', async () => {
      const { AuditLog, AuditLogSchema } = await import('./audit.schema');

      expect(AuditLogSchema).toBeDefined();
      expect(AuditLog).toBeDefined();
      expect(AuditLog.name).toBe('AuditLog');

      // Test schema paths
      expect(AuditLogSchema.path('userId')).toBeDefined();
      expect(AuditLogSchema.path('action')).toBeDefined();
      expect(AuditLogSchema.path('target')).toBeDefined();
      expect(AuditLogSchema.path('targetRef')).toBeDefined();
      expect(AuditLogSchema.path('jobId')).toBeDefined();
      expect(AuditLogSchema.path('metadata')).toBeDefined();
      expect(AuditLogSchema.path('ipAddress')).toBeDefined();
      expect(AuditLogSchema.path('userAgent')).toBeDefined();
      expect(AuditLogSchema.path('timestamp')).toBeDefined();
      expect(AuditLogSchema.path('success')).toBeDefined();
      expect(AuditLogSchema.path('error')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { AuditLogSchema } = await import('./audit.schema');

      const indexes = AuditLogSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Schema Exports', () => {
    it('should export all schemas from index', async () => {
      const schemas = await import('./index');

      expect(schemas.AssetSchema).toBeDefined();
      expect(schemas.FindingSchema).toBeDefined();
      expect(schemas.JobSchema).toBeDefined();
      expect(schemas.MetricSchema).toBeDefined();
      expect(schemas.AuditLogSchema).toBeDefined();
    });
  });
});

