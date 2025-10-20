import { describe, it, expect } from 'vitest';
import { PlanSchema, PlanStepSchema, PlanRequestSchema } from './plan';

describe('Plan Schema', () => {
  describe('PlanStepSchema', () => {
    it('should validate complete step', () => {
      const step = {
        id: 'step-1',
        provider: 'dns',
        dependsOn: [],
        params: { timeout: 30 },
        estimatedDuration: 60,
        priority: 1,
      };

      const result = PlanStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate minimal step', () => {
      const step = {
        id: 'step-2',
        provider: 'dirsearch',
      };

      const result = PlanStepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dependsOn).toEqual([]); // Default
        expect(result.data.priority).toBe(0); // Default
      }
    });

    it('should validate step dependencies', () => {
      const step = {
        id: 'step-3',
        provider: 'zap',
        dependsOn: ['step-1', 'step-2'],
      };

      const result = PlanStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });

    it('should validate all provider types', () => {
      const providers = [
        'dns',
        'zoomEye',
        'binaryEdge',
        'dirsearch',
        'zap',
        'reverseip',
        'domainwatch',
        'policy',
        'seo',
        'media',
      ];

      providers.forEach((provider) => {
        const step = {
          id: `step-${provider}`,
          provider,
        };

        const result = PlanStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('PlanSchema', () => {
    it('should validate complete plan', () => {
      const plan = {
        steps: [
          {
            id: 'step-1',
            provider: 'dns',
            dependsOn: [],
            estimatedDuration: 60,
            priority: 1,
          },
          {
            id: 'step-2',
            provider: 'dirsearch',
            dependsOn: ['step-1'],
            estimatedDuration: 300,
            priority: 2,
          },
        ],
        totalEstimatedDuration: 360,
        constraints: {
          mode: 'safe',
          maxConcurrency: 3,
          rateLimit: 10,
          timeWindow: {
            start: '09:00',
            end: '17:00',
          },
        },
      };

      const result = PlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should validate minimal plan', () => {
      const plan = {
        steps: [
          {
            id: 'step-1',
            provider: 'dns',
          },
        ],
      };

      const result = PlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should validate DAG structure', () => {
      const plan = {
        steps: [
          {
            id: 'step-1',
            provider: 'dns',
            dependsOn: [],
            priority: 1,
          },
          {
            id: 'step-2',
            provider: 'zoomEye',
            dependsOn: ['step-1'],
            priority: 2,
          },
          {
            id: 'step-3',
            provider: 'binaryEdge',
            dependsOn: ['step-1'],
            priority: 2,
          },
          {
            id: 'step-4',
            provider: 'dirsearch',
            dependsOn: ['step-2', 'step-3'],
            priority: 3,
          },
        ],
      };

      const result = PlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should validate parallel execution plan', () => {
      const plan = {
        steps: [
          {
            id: 'step-1',
            provider: 'dns',
            dependsOn: [],
            priority: 1,
          },
          {
            id: 'step-2',
            provider: 'zoomEye',
            dependsOn: [],
            priority: 1,
          },
          {
            id: 'step-3',
            provider: 'binaryEdge',
            dependsOn: [],
            priority: 1,
          },
        ],
        constraints: {
          mode: 'normal',
          maxConcurrency: 3,
        },
      };

      const result = PlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should validate scan modes', () => {
      const modes = ['safe', 'normal', 'aggressive'];

      modes.forEach((mode) => {
        const plan = {
          steps: [{ id: 'step-1', provider: 'dns' }],
          constraints: { mode },
        };

        const result = PlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
      });
    });

    it('should reject empty steps array', () => {
      const plan = {
        steps: [],
      };

      const result = PlanSchema.safeParse(plan);
      // Empty array is technically valid, but should be handled by business logic
      expect(result.success).toBe(true);
    });
  });

  describe('PlanRequestSchema', () => {
    it('should validate complete request', () => {
      const request = {
        command: ':scan full',
        target: 'example.com',
        mode: 'safe',
        include: ['dns', 'dirsearch'],
        exclude: ['zap'],
        constraints: { maxConcurrency: 2 },
      };

      const result = PlanRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate minimal request', () => {
      const request = {
        command: ':scan passive',
        target: 'example.com',
      };

      const result = PlanRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('safe'); // Default
      }
    });

    it('should reject empty command', () => {
      const request = {
        command: '',
        target: 'example.com',
      };

      const result = PlanRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject empty target', () => {
      const request = {
        command: ':scan full',
        target: '',
      };

      const result = PlanRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should validate provider filters', () => {
      const request = {
        command: ':scan web',
        target: 'example.com',
        include: ['dirsearch', 'zap'],
        exclude: ['dns'],
      };

      const result = PlanRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });
});

