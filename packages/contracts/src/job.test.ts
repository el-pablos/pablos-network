import { describe, it, expect } from 'vitest';
import { JobCreateSchema, JobUpdateSchema, CreateJobSchema, UpdateJobSchema } from './job';

describe('Job Schema', () => {
  it('should validate a valid job creation', () => {
    const validJob = {
      type: 'dns',
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      metadata: {
        mode: 'safe',
        timeout: 300,
      },
    };

    const result = CreateJobSchema.safeParse(validJob);
    expect(result.success).toBe(true);

    // Test backward compatibility alias
    const result2 = JobCreateSchema.safeParse(validJob);
    expect(result2.success).toBe(true);
  });

  it('should validate all job statuses', () => {
    const statuses = ['pending', 'running', 'done', 'failed', 'cancelled'];

    statuses.forEach((status) => {
      const update = {
        status,
      };

      const result = UpdateJobSchema.safeParse(update);
      expect(result.success).toBe(true);
    });
  });

  it('should validate job update with progress', () => {
    const update = {
      status: 'running',
      progress: 50,
      message: 'Processing...',
    };

    const result = UpdateJobSchema.safeParse(update);
    expect(result.success).toBe(true);

    // Test backward compatibility alias
    const result2 = JobUpdateSchema.safeParse(update);
    expect(result2.success).toBe(true);
  });

  it('should reject invalid progress value', () => {
    const update = {
      status: 'running',
      progress: 150, // Invalid: > 100
    };

    const result = UpdateJobSchema.safeParse(update);
    expect(result.success).toBe(false);
  });

  it('should accept job with error message', () => {
    const update = {
      status: 'failed',
      error: 'Connection timeout',
    };

    const result = UpdateJobSchema.safeParse(update);
    expect(result.success).toBe(true);
  });
});

