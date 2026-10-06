import { expect, it } from 'vitest';
import { healthResponseSchema, technicalJobSchema } from './index.js';
it('rejects contradictory dependency data shape', () =>
  expect(() =>
    healthResponseSchema.parse({ status: 'ok', services: { database: 'maybe', redis: 'up' } }),
  ).toThrow());
it('does not allow unknown job fields', () =>
  expect(() =>
    technicalJobSchema.parse({
      correlationId: '00000000-0000-4000-8000-000000000000',
      secret: 'private',
    }),
  ).toThrow());
