import { describe, it, expect } from 'vitest';
import { MetricSchema, CreateMetricSchema, MetricEntitySchema } from './metric';

describe('Metric Schema', () => {
  describe('MetricEntitySchema', () => {
    it('should validate job entity', () => {
      const entity = {
        kind: 'job',
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = MetricEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });

    it('should validate asset entity', () => {
      const entity = {
        kind: 'asset',
        id: '507f1f77bcf86cd799439011',
      };

      const result = MetricEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });

    it('should validate system entity', () => {
      const entity = {
        kind: 'system',
        id: 'global',
      };

      const result = MetricEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });

    it('should reject invalid entity kind', () => {
      const entity = {
        kind: 'invalid',
        id: 'test',
      };

      const result = MetricEntitySchema.safeParse(entity);
      expect(result.success).toBe(false);
    });
  });

  describe('MetricSchema', () => {
    it('should validate complete metric', () => {
      const metric = {
        _id: '507f1f77bcf86cd799439011',
        ts: new Date(),
        entity: {
          kind: 'job',
          id: '550e8400-e29b-41d4-a716-446655440000',
        },
        name: 'duration',
        value: 120.5,
        unit: 'seconds',
        metadata: { provider: 'dns' },
      };

      const result = MetricSchema.safeParse(metric);
      expect(result.success).toBe(true);
    });

    it('should validate minimal metric', () => {
      const metric = {
        ts: new Date(),
        entity: {
          kind: 'system',
          id: 'global',
        },
        name: 'cpu_usage',
        value: 45.2,
      };

      const result = MetricSchema.safeParse(metric);
      expect(result.success).toBe(true);
    });

    it('should reject empty metric name', () => {
      const metric = {
        ts: new Date(),
        entity: {
          kind: 'job',
          id: 'test',
        },
        name: '',
        value: 100,
      };

      const result = MetricSchema.safeParse(metric);
      expect(result.success).toBe(false);
    });

    it('should validate numeric value ranges', () => {
      const testCases = [
        { value: 0, expected: true },
        { value: -100, expected: true },
        { value: 999999, expected: true },
        { value: 0.001, expected: true },
      ];

      testCases.forEach(({ value, expected }) => {
        const metric = {
          ts: new Date(),
          entity: { kind: 'system', id: 'test' },
          name: 'test_metric',
          value,
        };

        const result = MetricSchema.safeParse(metric);
        expect(result.success).toBe(expected);
      });
    });

    it('should validate time-series data', () => {
      const now = new Date();
      const metrics = [
        {
          ts: new Date(now.getTime() - 3600000), // 1 hour ago
          entity: { kind: 'asset', id: '507f1f77bcf86cd799439011' },
          name: 'findings_count',
          value: 10,
        },
        {
          ts: new Date(now.getTime() - 1800000), // 30 min ago
          entity: { kind: 'asset', id: '507f1f77bcf86cd799439011' },
          name: 'findings_count',
          value: 15,
        },
        {
          ts: now,
          entity: { kind: 'asset', id: '507f1f77bcf86cd799439011' },
          name: 'findings_count',
          value: 20,
        },
      ];

      metrics.forEach((metric) => {
        const result = MetricSchema.safeParse(metric);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('CreateMetricSchema', () => {
    it('should validate metric creation', () => {
      const createMetric = {
        entity: {
          kind: 'job',
          id: '550e8400-e29b-41d4-a716-446655440000',
        },
        name: 'progress',
        value: 75,
        unit: 'percent',
      };

      const result = CreateMetricSchema.safeParse(createMetric);
      expect(result.success).toBe(true);
    });

    it('should not require timestamp on creation', () => {
      const createMetric = {
        entity: { kind: 'system', id: 'global' },
        name: 'memory_usage',
        value: 512,
        unit: 'MB',
      };

      const result = CreateMetricSchema.safeParse(createMetric);
      expect(result.success).toBe(true);
    });
  });
});

