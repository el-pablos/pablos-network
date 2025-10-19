import { z } from 'zod';
import { ObjectIdSchema, DateSchema } from './common';

export const EvidenceMetadataSchema = z.object({
  findingId: ObjectIdSchema.optional(),
  jobId: z.string().uuid().optional(),
  targetFqdn: z.string().optional(),
  contentType: z.string().default('application/octet-stream'),
  filename: z.string(),
  size: z.number().optional(),
  hash: z.string().optional(),
  source: z.string().optional(),
  uploadedAt: DateSchema.optional()
});

export type EvidenceMetadata = z.infer<typeof EvidenceMetadataSchema>;

export const EvidenceSchema = z.object({
  _id: ObjectIdSchema,
  length: z.number(),
  chunkSize: z.number(),
  uploadDate: DateSchema,
  filename: z.string(),
  metadata: EvidenceMetadataSchema.optional()
});

export type Evidence = z.infer<typeof EvidenceSchema>;

