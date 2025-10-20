import { z } from 'zod';
import { ObjectIdSchema, JobStatusSchema, DateSchema, ProviderSchema } from './common';

export const JobSchema = z.object({
  _id: ObjectIdSchema.optional(),
  jobId: z.string().uuid().optional(),
  type: ProviderSchema,
  targetRef: ObjectIdSchema,
  targetFqdn: z.string().optional(),
  status: JobStatusSchema.default('pending'),
  progress: z.number().min(0).max(100).default(0),
  message: z.string().optional(),
  error: z.string().optional(),
  startedAt: DateSchema.optional(),
  finishedAt: DateSchema.optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: DateSchema.optional(),
  updatedAt: DateSchema.optional()
});

export type Job = z.infer<typeof JobSchema>;

export const CreateJobSchema = z.object({
  type: ProviderSchema,
  targetRef: ObjectIdSchema,
  targetFqdn: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type CreateJob = z.infer<typeof CreateJobSchema>;

export const UpdateJobSchema = z.object({
  status: JobStatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  error: z.string().optional()
});

export type UpdateJob = z.infer<typeof UpdateJobSchema>;

// Backward compatibility aliases
export const JobCreateSchema = CreateJobSchema;
export const JobUpdateSchema = UpdateJobSchema;

