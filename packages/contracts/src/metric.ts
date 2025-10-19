import { z } from 'zod';
import { ObjectIdSchema, DateSchema } from './common';

export const MetricEntitySchema = z.object({
  kind: z.enum(['job', 'asset', 'system']),
  id: z.string()
});

export type MetricEntity = z.infer<typeof MetricEntitySchema>;

export const MetricSchema = z.object({
  _id: ObjectIdSchema.optional(),
  ts: DateSchema,
  entity: MetricEntitySchema,
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type Metric = z.infer<typeof MetricSchema>;

export const CreateMetricSchema = z.object({
  entity: MetricEntitySchema,
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type CreateMetric = z.infer<typeof CreateMetricSchema>;

