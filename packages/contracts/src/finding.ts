import { z } from 'zod';
import { ObjectIdSchema, ProviderSchema, CategorySchema, SeveritySchema, DateSchema } from './common';

export const FindingSchema = z.object({
  _id: ObjectIdSchema.optional(),
  targetRef: ObjectIdSchema,
  targetFqdn: z.string().optional(),
  provider: ProviderSchema,
  category: CategorySchema,
  title: z.string().min(1),
  description: z.string().optional(),
  severity: SeveritySchema,
  cvss: z.number().min(0).max(10).optional(),
  evidenceFileId: ObjectIdSchema.optional(),
  fingerprint: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  createdAt: DateSchema.optional(),
  updatedAt: DateSchema.optional()
});

export type Finding = z.infer<typeof FindingSchema>;

export const CreateFindingSchema = z.object({
  targetRef: ObjectIdSchema,
  targetFqdn: z.string().optional(),
  provider: ProviderSchema,
  category: CategorySchema,
  title: z.string().min(1),
  description: z.string().optional(),
  severity: SeveritySchema,
  cvss: z.number().min(0).max(10).optional(),
  evidenceFileId: ObjectIdSchema.optional(),
  fingerprint: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

export type CreateFinding = z.infer<typeof CreateFindingSchema>;

export const FindingQuerySchema = z.object({
  domain: z.string().optional(),
  severity: SeveritySchema.optional(),
  provider: ProviderSchema.optional(),
  category: CategorySchema.optional(),
  since: DateSchema.optional(),
  limit: z.number().min(1).max(1000).default(100),
  skip: z.number().min(0).default(0)
});

export type FindingQuery = z.infer<typeof FindingQuerySchema>;

