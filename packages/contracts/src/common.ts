import { z } from 'zod';

export const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const DateSchema = z.union([z.string().datetime(), z.date()]).transform(val => 
  typeof val === 'string' ? new Date(val) : val
);

export const AssetTypeSchema = z.enum(['domain', 'subdomain', 'ip']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const JobStatusSchema = z.enum(['pending', 'running', 'done', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const SeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ProviderSchema = z.enum([
  'zoomEye',
  'binaryEdge',
  'dirsearch',
  'zap',
  'dns',
  'reverseip',
  'domainwatch',
  'policy',
  'seo',
  'media'
]);
export type Provider = z.infer<typeof ProviderSchema>;

export const CategorySchema = z.enum(['DNS', 'WEB', 'NET', 'OSINT', 'POLICY', 'SEO', 'MEDIA']);
export type Category = z.infer<typeof CategorySchema>;

export const ScanModeSchema = z.enum(['safe', 'normal', 'aggressive']);
export type ScanMode = z.infer<typeof ScanModeSchema>;

