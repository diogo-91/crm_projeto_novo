import { z } from 'zod';
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'unavailable']),
  services: z.object({ database: z.enum(['up', 'down']), redis: z.enum(['up', 'down']) }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export const technicalJobSchema = z.object({ correlationId: z.uuid() }).strict();
export const technicalJobResultSchema = z.object({
  status: z.literal('ok'),
  correlationId: z.uuid(),
});
export type TechnicalJob = z.infer<typeof technicalJobSchema>;
export type TechnicalJobResult = z.infer<typeof technicalJobResultSchema>;

export * from './organizations.js';
export const problemResponseSchema = z
  .object({
    type: z.literal('about:blank'),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    code: z.string(),
    detail: z.string(),
    requestId: z.uuid().optional(),
  })
  .strict();
export type ProblemResponse = z.infer<typeof problemResponseSchema>;

export * from './identity.js';
export * from './auth.js';
export * from './access-control.js';

export * from './commercial.js';

export * from './sales.js';

export * from './tasks.js';
