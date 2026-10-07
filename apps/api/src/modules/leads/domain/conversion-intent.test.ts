import { it, expect } from 'vitest';
import { conversionSchema } from '@crm/contracts';
import { conversionIntent } from './conversion-intent.js';
const input = conversionSchema.parse({
  pipelineId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  expectedVersion: 2,
});
it('same conversion intent ignores retry version and insertion order', () =>
  expect(conversionIntent({ ...input, expectedVersion: 3 })).toBe(conversionIntent(input)));
it('equivalent decimal strings produce the same intent', () =>
  expect(conversionIntent({ ...input, amount: '0000.00' })).toBe(conversionIntent(input)));
it('changing destination or explicit relationship clear is a different intent', () => {
  expect(conversionIntent({ ...input, stageId: input.pipelineId })).not.toBe(
    conversionIntent(input),
  );
  expect(conversionIntent({ ...input, contactId: null })).not.toBe(conversionIntent(input));
});
