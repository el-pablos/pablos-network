import { z } from 'zod';
import { ObjectIdSchema, DateSchema } from './common';

export const AuditLogSchema = z.object({
  _id: ObjectIdSchema.optional(),
  userId: z.string().optional(),
  action: z.string().min(1),
  target: z.string().optional(),
  targetRef: ObjectIdSchema.optional(),
  jobId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: DateSchema,
  success: z.boolean().default(true),
  error: z.string().optional()
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const CreateAuditLogSchema = z.object({
  userId: z.string().optional(),
  action: z.string().min(1),
  target: z.string().optional(),
  targetRef: ObjectIdSchema.optional(),
  jobId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  success: z.boolean().default(true),
  error: z.string().optional()
});

export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;

