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

      // Reference the class to execute class definition
      expect(Asset).toBeDefined();
      expect(Asset.name).toBe('Asset');

      // Create a local model (no DB connection needed)
      const AssetModel = mongoose.model('Asset_Test_1', AssetSchema);

      // Test valid document - this executes the schema validation logic
      const validDoc = new AssetModel({
        type: 'domain',
        fqdn: 'example.com',
        active: true,
        parentFqdn: 'parent.com',
        ip: ['192.168.1.1', '192.168.1.2'],
        owner: 'test-owner',
        verifiedAt: new Date(),
        consentToken: 'test-token',
        metadata: { test: 'data' }
      });

      // Validate executes the @Prop decorators
      await validDoc.validate();
      expect(validDoc.type).toBe('domain');
      expect(validDoc.fqdn).toBe('example.com');
      expect(validDoc.active).toBe(true);
      expect(validDoc.parentFqdn).toBe('parent.com');
      expect(validDoc.ip).toEqual(['192.168.1.1', '192.168.1.2']);
      expect(validDoc.owner).toBe('test-owner');
      expect(validDoc.verifiedAt).toBeInstanceOf(Date);
      expect(validDoc.consentToken).toBe('test-token');
      expect(validDoc.metadata).toEqual({ test: 'data' });

      // Test required field violation
      const invalidDoc = new AssetModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test enum violation
      const invalidEnum = new AssetModel({ type: 'invalid' as any });
      await expect(invalidEnum.validate()).rejects.toThrow();

      // Test all enum values
      for (const type of ['domain', 'subdomain', 'ip']) {
        const doc = new AssetModel({ type });
        await doc.validate();
        expect(doc.type).toBe(type);
      }
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

      // Reference the class
      expect(Finding).toBeDefined();
      expect(Finding.name).toBe('Finding');

      const FindingModel = mongoose.model('Finding_Test_1', FindingSchema);

      // Test valid document with all fields
      const validDoc = new FindingModel({
        targetRef: new mongoose.Types.ObjectId(),
        targetFqdn: 'example.com',
        provider: 'dns',
        category: 'DNS',
        title: 'Test Finding',
        description: 'Test description',
        severity: 'high',
        cvss: 7.5,
        evidenceFileId: new mongoose.Types.ObjectId(),
        fingerprint: 'test-fingerprint-123',
        metadata: { test: 'data' }
      });

      await validDoc.validate();
      expect(validDoc.provider).toBe('dns');
      expect(validDoc.severity).toBe('high');
      expect(validDoc.category).toBe('DNS');
      expect(validDoc.title).toBe('Test Finding');
      expect(validDoc.description).toBe('Test description');
      expect(validDoc.cvss).toBe(7.5);
      expect(validDoc.fingerprint).toBe('test-fingerprint-123');

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

      // Test all severity enum values
      for (const severity of ['info', 'low', 'medium', 'high', 'critical']) {
        const doc = new FindingModel({
          targetRef: new mongoose.Types.ObjectId(),
          provider: 'dns',
          category: 'DNS',
          title: 'Test',
          fingerprint: 'test-' + severity,
          severity
        });
        await doc.validate();
        expect(doc.severity).toBe(severity);
      }
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

      // Reference the class
      expect(Job).toBeDefined();
      expect(Job.name).toBe('Job');

      const JobModel = mongoose.model('Job_Test_1', JobSchema);

      // Test valid document with all fields
      const validDoc = new JobModel({
        jobId: 'test-job-123',
        targetRef: new mongoose.Types.ObjectId(),
        targetFqdn: 'example.com',
        type: 'dns',
        message: 'Processing',
        error: null,
        startedAt: new Date(),
        finishedAt: null,
        metadata: { test: 'data' }
      });

      await validDoc.validate();
      expect(validDoc.type).toBe('dns');
      expect(validDoc.status).toBe('pending'); // default value
      expect(validDoc.progress).toBe(0); // default value
      expect(validDoc.jobId).toBe('test-job-123');
      expect(validDoc.targetFqdn).toBe('example.com');
      expect(validDoc.message).toBe('Processing');

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

      // Test all status enum values
      for (const status of ['pending', 'running', 'done', 'failed', 'cancelled']) {
        const doc = new JobModel({
          jobId: 'test-job-' + status,
          targetRef: new mongoose.Types.ObjectId(),
          type: 'dns',
          status
        });
        await doc.validate();
        expect(doc.status).toBe(status);
      }
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

      // Reference the class
      expect(Metric).toBeDefined();
      expect(Metric.name).toBe('Metric');

      const MetricModel = mongoose.model('Metric_Test_1', MetricSchema);

      // Test valid document with all fields
      const validDoc = new MetricModel({
        ts: new Date(),
        entity: {
          kind: 'job',
          id: 'test-job-123'
        },
        name: 'progress',
        value: 50,
        unit: 'percent',
        metadata: { test: 'data' }
      });

      await validDoc.validate();
      expect(validDoc.entity.kind).toBe('job');
      expect(validDoc.entity.id).toBe('test-job-123');
      expect(validDoc.name).toBe('progress');
      expect(validDoc.value).toBe(50);
      expect(validDoc.unit).toBe('percent');
      expect(validDoc.metadata).toEqual({ test: 'data' });

      // Test required field violation
      const invalidDoc = new MetricModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test all entity kind enum values
      for (const kind of ['job', 'asset', 'system']) {
        const doc = new MetricModel({
          ts: new Date(),
          entity: {
            kind: kind as any,
            id: 'test-id'
          },
          name: 'test-metric',
          value: 100
        });
        await doc.validate();
        expect(doc.entity.kind).toBe(kind);
      }
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
      const { AuditLog, AuditLogSchema } = await import('./audit.schema');

      // Reference the class
      expect(AuditLog).toBeDefined();
      expect(AuditLog.name).toBe('AuditLog');

      const AuditLogModel = mongoose.model('AuditLog_Test_1', AuditLogSchema);

      // Test valid document with all fields
      const validDoc = new AuditLogModel({
        userId: 'user-123',
        action: 'create',
        target: 'asset',
        targetRef: new mongoose.Types.ObjectId(),
        jobId: 'job-456',
        metadata: { test: 'data' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        error: null
      });

      await validDoc.validate();
      expect(validDoc.action).toBe('create');
      expect(validDoc.target).toBe('asset');
      expect(validDoc.success).toBe(true); // default value
      expect(validDoc.userId).toBe('user-123');
      expect(validDoc.jobId).toBe('job-456');
      expect(validDoc.ipAddress).toBe('192.168.1.1');
      expect(validDoc.userAgent).toBe('Mozilla/5.0');
      expect(validDoc.metadata).toEqual({ test: 'data' });

      // Test required field violation
      const invalidDoc = new AuditLogModel({});
      await expect(invalidDoc.validate()).rejects.toThrow();

      // Test success field with false value
      const failedAudit = new AuditLogModel({
        action: 'delete',
        timestamp: new Date(),
        success: false,
        error: 'Operation failed'
      });
      await failedAudit.validate();
      expect(failedAudit.success).toBe(false);
      expect(failedAudit.error).toBe('Operation failed');
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