import { describe, it, expect } from 'vitest';
import {
  ObjectIdSchema,
  DateSchema,
  AssetTypeSchema,
  JobStatusSchema,
  SeveritySchema,
  ProviderSchema,
  CategorySchema,
  ScanModeSchema,
} from './common';

describe('Common Schemas', () => {
  describe('ObjectIdSchema', () => {
    it('should validate valid ObjectId', () => {
      const validIds = [
        '507f1f77bcf86cd799439011',
        '000000000000000000000000',
        'FFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      validIds.forEach((id) => {
        const result = ObjectIdSchema.safeParse(id);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid ObjectId', () => {
      const invalidIds = [
        '507f1f77bcf86cd79943901', // Too short
        '507f1f77bcf86cd7994390111', // Too long
        'invalid-object-id',
        '507f1f77bcf86cd79943901g', // Invalid character
        '',
      ];

      invalidIds.forEach((id) => {
        const result = ObjectIdSchema.safeParse(id);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('DateSchema', () => {
    it('should accept ISO datetime string', () => {
      const result = DateSchema.safeParse('2024-01-01T00:00:00.000Z');
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Date);
    });

    it('should accept Date object', () => {
      const date = new Date();
      const result = DateSchema.safeParse(date);
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Date);
    });

    it('should reject invalid date string', () => {
      const result = DateSchema.safeParse('not-a-date');
      expect(result.success).toBe(false);
    });
  });

  describe('AssetTypeSchema', () => {
    it('should accept all valid asset types', () => {
      const types = ['domain', 'subdomain', 'ip'];
      
      types.forEach((type) => {
        const result = AssetTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid asset type', () => {
      const result = AssetTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('JobStatusSchema', () => {
    it('should accept all valid job statuses', () => {
      const statuses = ['pending', 'running', 'done', 'failed', 'cancelled'];
      
      statuses.forEach((status) => {
        const result = JobStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid job status', () => {
      const result = JobStatusSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('SeveritySchema', () => {
    it('should accept all valid severity levels', () => {
      const severities = ['info', 'low', 'medium', 'high', 'critical'];
      
      severities.forEach((severity) => {
        const result = SeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid severity', () => {
      const result = SeveritySchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('ProviderSchema', () => {
    it('should accept all valid providers', () => {
      const providers = [
        'zoomEye',
        'binaryEdge',
        'dirsearch',
        'zap',
        'dns',
        'reverseip',
        'domainwatch',
        'policy',
        'seo',
        'media',
      ];
      
      providers.forEach((provider) => {
        const result = ProviderSchema.safeParse(provider);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid provider', () => {
      const result = ProviderSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('CategorySchema', () => {
    it('should accept all valid categories', () => {
      const categories = ['DNS', 'WEB', 'NET', 'OSINT', 'POLICY', 'SEO', 'MEDIA'];
      
      categories.forEach((category) => {
        const result = CategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid category', () => {
      const result = CategorySchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('ScanModeSchema', () => {
    it('should accept all valid scan modes', () => {
      const modes = ['safe', 'normal', 'aggressive'];
      
      modes.forEach((mode) => {
        const result = ScanModeSchema.safeParse(mode);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid scan mode', () => {
      const result = ScanModeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });
});

