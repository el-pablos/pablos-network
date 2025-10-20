import { describe, it, expect, beforeEach } from 'vitest';
import { useJobsStore } from './jobs';

describe('Jobs Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useJobsStore.setState({ jobs: [] });
  });

  it('should add a new job', () => {
    const { addJob, jobs } = useJobsStore.getState();
    
    const newJob = {
      jobId: 'job-1',
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      status: 'queued' as const,
      progress: 0,
      createdAt: new Date(),
    };

    addJob(newJob);
    
    const state = useJobsStore.getState();
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].jobId).toBe('job-1');
  });

  it('should update an existing job', () => {
    const { addJob, updateJob } = useJobsStore.getState();
    
    const newJob = {
      jobId: 'job-1',
      targetRef: '507f1f77bcf86cd799439011',
      targetFqdn: 'example.com',
      provider: 'dns',
      status: 'queued' as const,
      progress: 0,
      createdAt: new Date(),
    };

    addJob(newJob);
    updateJob('job-1', { status: 'running', progress: 50 });
    
    const state = useJobsStore.getState();
    expect(state.jobs[0].status).toBe('running');
    expect(state.jobs[0].progress).toBe(50);
  });

  it('should limit jobs to 50', () => {
    const { addJob } = useJobsStore.getState();
    
    // Add 60 jobs
    for (let i = 0; i < 60; i++) {
      addJob({
        jobId: `job-${i}`,
        targetRef: '507f1f77bcf86cd799439011',
        targetFqdn: 'example.com',
        provider: 'dns',
        status: 'queued' as const,
        progress: 0,
        createdAt: new Date(),
      });
    }
    
    const state = useJobsStore.getState();
    expect(state.jobs).toHaveLength(50);
    // Should keep the most recent jobs
    expect(state.jobs[0].jobId).toBe('job-59');
  });

  it('should not update non-existent job', () => {
    const { updateJob } = useJobsStore.getState();
    
    updateJob('non-existent', { status: 'running' });
    
    const state = useJobsStore.getState();
    expect(state.jobs).toHaveLength(0);
  });
});

