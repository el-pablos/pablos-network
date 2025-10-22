import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';

describe('Gateway Schemas', () => {
  beforeEach(() => {
    // Clear all models before each test to avoid conflicts
    mongoose.deleteModel(/.+/);
  });

  describe('Asset Schema', () => {
    it('should validate required fields and enums', async () => {
      const { Asset, AssetSchema } = await import('./asset.schema');

      // Create a local model (no DB connection needed)
      const AssetModel = mongoose.model('Asset_Test_1', AssetSchema);

      // Test valid document
      const validDoc = new AssetModel({
        type: 'domain',
        fqdn: 'example.com',
        active: true
      });

      // Validate executes the @Prop decorators
      await validDoc.validate();
      expect(validDoc.type).toBe('domain');
      expect(validDoc.fqdn).toBe('example.com');
      expect(validDoc.active).toBe(true);

      // Test required field violation
      const invalidDoc = new AssetModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test enum violation
      const invalidEnum = new AssetModel({ type: 'invalid' as any });
      await expect(invalidEnum.validate()).rejects.toThrow();
    });

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
    it('should validate required fields and enums', async () => {
      const { Finding, FindingSchema } = await import('./finding.schema');

      const FindingModel = mongoose.model('Finding_Test_1', FindingSchema);

      // Test valid document
      const validDoc = new FindingModel({
        targetRef: new mongoose.Types.ObjectId(),
        targetFqdn: 'example.com',
        provider: 'dns', // Valid enum value
        category: 'DNS', // Valid enum value
        title: 'Test Finding',
        description: 'Test description',
        severity: 'high',
        fingerprint: 'test-fingerprint-123'
      });

      await validDoc.validate();
      expect(validDoc.provider).toBe('dns');
      expect(validDoc.severity).toBe('high');
      expect(validDoc.category).toBe('DNS');

      // Test required field violation
      const invalidDoc = new FindingModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test enum violation for severity
      const invalidSeverity = new FindingModel({
        targetRef: new mongoose.Types.ObjectId(),
        provider: 'dns',
        category: 'DNS',
        title: 'Test',
        fingerprint: 'test',
        severity: 'invalid' as any
      });
      await expect(invalidSeverity.validate()).rejects.toThrow();
    });

    it('should have correct indexes', async () => {
      const { FindingSchema } = await import('./finding.schema');

      const indexes = FindingSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for targetRef + provider compound index
      const targetProviderIndex = indexes.find((idx: any) =>
        idx[0].targetRef === 1 && idx[0].provider === 1
      );
      expect(targetProviderIndex).toBeDefined();
    });
  });

  describe('Job Schema', () => {
    it('should validate required fields and defaults', async () => {
      const { Job, JobSchema } = await import('./job.schema');

      const JobModel = mongoose.model('Job_Test_1', JobSchema);

      // Test valid document with defaults
      const validDoc = new JobModel({
        jobId: 'test-job-123',
        targetRef: new mongoose.Types.ObjectId(),
        type: 'dns' // This is the provider enum
      });

      await validDoc.validate();
      expect(validDoc.type).toBe('dns');
      expect(validDoc.status).toBe('pending'); // default value
      expect(validDoc.progress).toBe(0); // default value

      // Test required field violation
      const invalidDoc = new JobModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test enum violation for type
      const invalidType = new JobModel({
        jobId: 'test-job-456',
        targetRef: new mongoose.Types.ObjectId(),
        type: 'invalid' as any
      });
      await expect(invalidType.validate()).rejects.toThrow();
    });

    it('should have correct indexes', async () => {
      const { JobSchema } = await import('./job.schema');

      const indexes = JobSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for targetRef + type compound index
      const targetTypeIndex = indexes.find((idx: any) =>
        idx[0].targetRef === 1 && idx[0].type === 1
      );
      expect(targetTypeIndex).toBeDefined();
    });
  });

  describe('Metric Schema', () => {
    it('should validate required fields and TTL', async () => {
      const { Metric, MetricSchema } = await import('./metric.schema');

      const MetricModel = mongoose.model('Metric_Test_1', MetricSchema);

      // Test valid document
      const validDoc = new MetricModel({
        ts: new Date(),
        entity: {
          kind: 'job',
          id: 'test-job-123'
        },
        name: 'progress',
        value: 50
      });

      await validDoc.validate();
      expect(validDoc.entity.kind).toBe('job');
      expect(validDoc.entity.id).toBe('test-job-123');
      expect(validDoc.name).toBe('progress');
      expect(validDoc.value).toBe(50);

      // Test required field violation
      const invalidDoc = new MetricModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();
    });

    it('should have TTL index', async () => {
      const { MetricSchema } = await import('./metric.schema');

      const indexes = MetricSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for TTL index on ts field
      const ttlIndex = indexes.find((idx: any) =>
        idx[0].ts === 1 && idx[1]?.expireAfterSeconds !== undefined
      );
      expect(ttlIndex).toBeDefined();
      if (ttlIndex) {
        expect(ttlIndex[1].expireAfterSeconds).toBe(14 * 24 * 60 * 60); // 14 days
      }
    });
  });

  describe('Audit Schema', () => {
    it('should validate required fields', async () => {
      const { AuditLogSchema } = await import('./audit.schema');

      const AuditLogModel = mongoose.model('AuditLog_Test_1', AuditLogSchema);

      // Test valid document
      const validDoc = new AuditLogModel({
        action: 'create',
        target: 'asset',
        targetRef: new mongoose.Types.ObjectId(),
        userId: 'user-123',
        timestamp: new Date()
      });

      await validDoc.validate();
      expect(validDoc.action).toBe('create');
      expect(validDoc.target).toBe('asset');
      expect(validDoc.success).toBe(true); // default value

      // Test required field violation
      const invalidDoc = new AuditLogModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();
    });

    it('should have correct indexes', async () => {
      const { AuditLogSchema } = await import('./audit.schema');

      const indexes = AuditLogSchema.indexes();
      expect(indexes.length).toBeGreaterThan(0);

      // Check for targetRef + timestamp compound index
      const targetRefIndex = indexes.find((idx: any) =>
        idx[0].targetRef === 1 && idx[0].timestamp === -1
      );
      expect(targetRefIndex).toBeDefined();
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