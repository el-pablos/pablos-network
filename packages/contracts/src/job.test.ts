import { describe, it, expect } from 'vitest';
import { JobCreateSchema, JobUpdateSchema } from './job';

describe('Job Schema', () => {
  it('should validate a valid job creation', () => {
    const validJob = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      status: 'queued',
      config: {
        mode: 'safe',
        timeout: 300,
      },
    };

    const result = JobCreateSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it('should validate all job statuses', () => {
    const statuses = ['queued', 'running', 'done', 'failed'];
    
    statuses.forEach((status) => {
      const job = {
        targetRef: '507f1f77bcf86cd799439011',
        targetFqdn: 'example.com',
        provider: 'dns',
        status,
      };

      const result = JobCreateSchema.safeParse(job);
      expect(result.success).toBe(true);
    });
  });

  it('should validate job update with progress', () => {
    const update = {
      status: 'running',
      progress: 50,
      logs: ['Started scan', 'Processing...'],
    };

    const result = JobUpdateSchema.safeParse(update);
    expect(result.success).toBe(true);
  });

  it('should reject invalid progress value', () => {
    const update = {
      status: 'running',
      progress: 150, // Invalid: > 100
    };

    const result = JobUpdateSchema.safeParse(update);
    expect(result.success).toBe(false);
  });

  it('should accept job with error message', () => {
    const job = {
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dast',
      status: 'failed',
      error: 'Connection timeout',
    };

    const result = JobCreateSchema.safeParse(job);
    expect(result.success).toBe(true);
  });
});

