import { describe, it, expect } from 'vitest';
import { AuditLogSchema, CreateAuditLogSchema } from './audit';

describe('Audit Schema', () => {
  describe('AuditLogSchema', () => {
    it('should validate complete audit log', () => {
      const audit = {
        _id: '507f1f77bcf86cd799439011',
        userId: 'user-123',
        action: 'scope:add',
        target: 'example.com',
        targetRef: '507f1f77bcf86cd799439012',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        metadata: { source: 'api' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        success: true,
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(true);
    });

    it('should validate minimal audit log', () => {
      const audit = {
        action: 'scan:start',
        timestamp: new Date(),
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true); // Default value
      }
    });

    it('should reject empty action', () => {
      const audit = {
        action: '',
        timestamp: new Date(),
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(false);
    });

    it('should validate UUID jobId', () => {
      const audit = {
        action: 'job:create',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date(),
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID jobId', () => {
      const audit = {
        action: 'job:create',
        jobId: 'not-a-uuid',
        timestamp: new Date(),
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(false);
    });

    it('should include error message on failure', () => {
      const audit = {
        action: 'scan:failed',
        timestamp: new Date(),
        success: false,
        error: 'Connection timeout',
      };

      const result = AuditLogSchema.safeParse(audit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe('Connection timeout');
      }
    });
  });

  describe('CreateAuditLogSchema', () => {
    it('should validate audit log creation', () => {
      const createAudit = {
        action: 'scope:verify',
        target: 'example.com',
        success: true,
      };

      const result = CreateAuditLogSchema.safeParse(createAudit);
      expect(result.success).toBe(true);
    });

    it('should not require timestamp on creation', () => {
      const createAudit = {
        action: 'finding:create',
      };

      const result = CreateAuditLogSchema.safeParse(createAudit);
      expect(result.success).toBe(true);
    });
  });
});

