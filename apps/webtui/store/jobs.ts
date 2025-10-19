import { create } from 'zustand';

export interface Job {
  jobId: string;
  provider: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  message?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

interface JobsState {
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  
  addJob: (job: Job) =>
    set((state) => ({
      jobs: [job, ...state.jobs].slice(0, 50), // Keep last 50 jobs
    })),
  
  updateJob: (jobId: string, updates: Partial<Job>) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.jobId === jobId ? { ...job, ...updates } : job
      ),
    })),
  
  removeJob: (jobId: string) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.jobId !== jobId),
    })),
  
  clearJobs: () => set({ jobs: [] }),
}));

