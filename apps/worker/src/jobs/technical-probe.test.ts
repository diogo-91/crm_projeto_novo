import { expect, it } from 'vitest';
import { processTechnicalProbe } from './technical-probe.js';
it('preserves correlation through the technical job', () =>
  expect(processTechnicalProbe({ correlationId: '00000000-0000-4000-8000-000000000000' })).toEqual({
    status: 'ok',
    correlationId: '00000000-0000-4000-8000-000000000000',
  }));
it('fails an invalid payload instead of hiding the failure', () =>
  expect(() => processTechnicalProbe({ correlationId: 'invalid' })).toThrow());
