import { z } from 'zod';
import { ProviderSchema, ScanModeSchema } from './common';

export const PlanStepSchema = z.object({
  id: z.string(),
  provider: ProviderSchema,
  dependsOn: z.array(z.string()).default([]),
  params: z.record(z.any()).optional(),
  estimatedDuration: z.number().optional(),
  priority: z.number().default(0)
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  steps: z.array(PlanStepSchema),
  totalEstimatedDuration: z.number().optional(),
  constraints: z.object({
    mode: ScanModeSchema.default('safe'),
    maxConcurrency: z.number().default(3),
    rateLimit: z.number().optional(),
    timeWindow: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional()
  }).optional()
});

export type Plan = z.infer<typeof PlanSchema>;

export const PlanRequestSchema = z.object({
  command: z.string().min(1),
  target: z.string().min(1),
  mode: ScanModeSchema.default('safe'),
  include: z.array(ProviderSchema).optional(),
  exclude: z.array(ProviderSchema).optional(),
  constraints: z.record(z.any()).optional()
});

export type PlanRequest = z.infer<typeof PlanRequestSchema>;

