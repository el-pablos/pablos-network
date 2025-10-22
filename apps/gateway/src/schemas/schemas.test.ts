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

      // Check for fqdn unique index
      const fqdnIndex = indexes.find((idx: any) => {
        const keys = Object.keys(idx[0]);
        return keys.length === 1 && idx[0].fqdn === 1 && idx[1]?.unique === true;
      });
      expect(fqdnIndex).toBeDefined();

      // Check for compound indexes
      const parentActiveIndex = indexes.find((idx: any) => idx[0].parentFqdn === 1 && idx[0].active === 1);
      expect(parentActiveIndex).toBeDefined();

      const typeActiveIndex = indexes.find((idx: any) => idx[0].type === 1 && idx[0].active === 1);
      expect(typeActiveIndex).toBeDefined();
    });
  });

  describe('Finding Schema', () => {
    it('should create finding schema with correct properties', async () => {
      const { Finding, FindingSchema } = await import('./finding.schema');

      expect(FindingSchema).toBeDefined();
      expect(Finding).toBeDefined();
      expect(Finding.name).toBe('Finding');

      // Test schema paths
      const targetRefPath = FindingSchema.path('targetRef');
      expect(targetRefPath).toBeDefined();
      expect(targetRefPath.isRequired).toBe(true);

      expect(FindingSchema.path('targetFqdn')).toBeDefined();

      const providerPath = FindingSchema.path('provider');
      expect(providerPath).toBeDefined();
      expect(providerPath.isRequired).toBe(true);

      const categoryPath = FindingSchema.path('category');
      expect(categoryPath).toBeDefined();
      expect(categoryPath.isRequired).toBe(true);

      const titlePath = FindingSchema.path('title');
      expect(titlePath).toBeDefined();
      expect(titlePath.isRequired).toBe(true);

      expect(FindingSchema.path('description')).toBeDefined();

      const severityPath = FindingSchema.path('severity');
      expect(severityPath).toBeDefined();
      expect(severityPath.isRequired).toBe(true);

      expect(FindingSchema.path('cvss')).toBeDefined();
      expect(FindingSchema.path('evidenceFileId')).toBeDefined();

      const fingerprintPath = FindingSchema.path('fingerprint');
      expect(fingerprintPath).toBeDefined();
      expect(fingerprintPath.isRequired).toBe(true);

      expect(FindingSchema.path('metadata')).toBeDefined();

      // Test timestamps
      expect(FindingSchema.path('createdAt')).toBeDefined();
      expect(FindingSchema.path('updatedAt')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { FindingSchema } = await import('./finding.schema');

      const indexes = FindingSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for compound unique index
      const compoundIndex = indexes.find((idx: any) =>
        idx[0].targetRef === 1 && idx[0].provider === 1 && idx[0].fingerprint === 1
      );
      expect(compoundIndex).toBeDefined();
      if (compoundIndex) {
        expect(compoundIndex[1].unique).toBe(true);
      }
    });
  });

  describe('Job Schema', () => {
    it('should create job schema with correct properties', async () => {
      const { Job, JobSchema } = await import('./job.schema');

      expect(JobSchema).toBeDefined();
      expect(Job).toBeDefined();
      expect(Job.name).toBe('Job');

      // Test schema paths
      const jobIdPath = JobSchema.path('jobId');
      expect(jobIdPath).toBeDefined();
      expect(jobIdPath.isRequired).toBe(true);

      const targetRefPath = JobSchema.path('targetRef');
      expect(targetRefPath).toBeDefined();
      expect(targetRefPath.isRequired).toBe(true);

      expect(JobSchema.path('targetFqdn')).toBeDefined();

      const typePath = JobSchema.path('type');
      expect(typePath).toBeDefined();
      expect(typePath.isRequired).toBe(true);

      const statusPath = JobSchema.path('status');
      expect(statusPath).toBeDefined();
      expect(statusPath.isRequired).toBe(true);
      expect((statusPath as any).defaultValue).toBe('pending');

      const progressPath = JobSchema.path('progress');
      expect(progressPath).toBeDefined();
      expect((progressPath as any).defaultValue).toBe(0);

      expect(JobSchema.path('message')).toBeDefined();
      expect(JobSchema.path('startedAt')).toBeDefined();
      expect(JobSchema.path('finishedAt')).toBeDefined();
      expect(JobSchema.path('error')).toBeDefined();
      expect(JobSchema.path('metadata')).toBeDefined();

      // Test timestamps
      expect(JobSchema.path('createdAt')).toBeDefined();
      expect(JobSchema.path('updatedAt')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { JobSchema } = await import('./job.schema');

      const indexes = JobSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for jobId unique index
      const jobIdIndex = indexes.find((idx: any) => idx[0].jobId === 1);
      expect(jobIdIndex).toBeDefined();
      if (jobIdIndex) {
        expect(jobIdIndex[1].unique).toBe(true);
      }
    });
  });

  describe('Metric Schema', () => {
    it('should create metric schema with correct properties', async () => {
      const { Metric, MetricSchema } = await import('./metric.schema');

      expect(MetricSchema).toBeDefined();
      expect(Metric).toBeDefined();
      expect(Metric.name).toBe('Metric');

      // Test schema paths
      const tsPath = MetricSchema.path('ts');
      expect(tsPath).toBeDefined();
      expect(tsPath.isRequired).toBe(true);

      const entityPath = MetricSchema.path('entity');
      expect(entityPath).toBeDefined();
      expect(entityPath.isRequired).toBe(true);

      const namePath = MetricSchema.path('name');
      expect(namePath).toBeDefined();
      expect(namePath.isRequired).toBe(true);

      const valuePath = MetricSchema.path('value');
      expect(valuePath).toBeDefined();
      expect(valuePath.isRequired).toBe(true);

      expect(MetricSchema.path('unit')).toBeDefined();
      expect(MetricSchema.path('metadata')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { MetricSchema } = await import('./metric.schema');

      const indexes = MetricSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for TTL index
      const ttlIndex = indexes.find((idx: any) => idx[0].ts === 1 && idx[1].expireAfterSeconds);
      expect(ttlIndex).toBeDefined();
      if (ttlIndex) {
        expect(ttlIndex[1].expireAfterSeconds).toBe(14 * 24 * 60 * 60);
      }
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

      const actionPath = AuditLogSchema.path('action');
      expect(actionPath).toBeDefined();
      expect(actionPath.isRequired).toBe(true);

      expect(AuditLogSchema.path('target')).toBeDefined();
      expect(AuditLogSchema.path('targetRef')).toBeDefined();
      expect(AuditLogSchema.path('jobId')).toBeDefined();
      expect(AuditLogSchema.path('metadata')).toBeDefined();
      expect(AuditLogSchema.path('ipAddress')).toBeDefined();
      expect(AuditLogSchema.path('userAgent')).toBeDefined();

      const timestampPath = AuditLogSchema.path('timestamp');
      expect(timestampPath).toBeDefined();
      expect(timestampPath.isRequired).toBe(true);

      const successPath = AuditLogSchema.path('success');
      expect(successPath).toBeDefined();
      expect((successPath as any).defaultValue).toBe(true);

      expect(AuditLogSchema.path('error')).toBeDefined();
    });

    it('should have correct indexes', async () => {
      const { AuditLogSchema } = await import('./audit.schema');

      const indexes = AuditLogSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for timestamp index
      const timestampIndex = indexes.find((idx: any) => idx[0].timestamp === -1 && Object.keys(idx[0]).length === 1);
      expect(timestampIndex).toBeDefined();

      // Check for compound indexes
      const userIdTimestampIndex = indexes.find((idx: any) => idx[0].userId === 1 && idx[0].timestamp === -1);
      expect(userIdTimestampIndex).toBeDefined();

      const actionTimestampIndex = indexes.find((idx: any) => idx[0].action === 1 && idx[0].timestamp === -1);
      expect(actionTimestampIndex).toBeDefined();

      const targetRefTimestampIndex = indexes.find((idx: any) => idx[0].targetRef === 1 && idx[0].timestamp === -1);
      expect(targetRefTimestampIndex).toBeDefined();
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

