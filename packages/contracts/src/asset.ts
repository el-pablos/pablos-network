import { z } from 'zod';
import { ObjectIdSchema, AssetTypeSchema, DateSchema } from './common';

export const AssetSchema = z.object({
  _id: ObjectIdSchema.optional(),
  type: AssetTypeSchema,
  fqdn: z.string().min(1).optional(),
  parentFqdn: z.string().optional(),
  active: z.boolean().default(true),
  ip: z.array(z.string().ip()).default([]),
  owner: z.string().optional(),
  verifiedAt: DateSchema.optional(),
  consentToken: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: DateSchema.optional(),
  updatedAt: DateSchema.optional()
});

export type Asset = z.infer<typeof AssetSchema>;

export const CreateAssetSchema = z.object({
  type: AssetTypeSchema,
  fqdn: z.string().min(1).optional(),
  parentFqdn: z.string().optional(),
  ip: z.array(z.string().ip()).optional(),
  owner: z.string().optional(),
  verify: z.enum(['dns', 'http']).optional()
});

export type CreateAsset = z.infer<typeof CreateAssetSchema>;

export const VerifyAssetSchema = z.object({
  domain: z.string().min(1),
  method: z.enum(['dns', 'http']),
  token: z.string()
});

export type VerifyAsset = z.infer<typeof VerifyAssetSchema>;

