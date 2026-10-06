import { expect, it } from 'vitest';
import { validCorrelationId } from './request-context.js';
it('accepts bounded identifiers without control characters', () => {
  expect(validCorrelationId('request_01-A')).toBe(true);
  expect(validCorrelationId('a'.repeat(64))).toBe(true);
});
it.each(['a'.repeat(65), 'bad\nvalue', '', ['first', 'second']])(
  'rejects unsafe correlation IDs',
  (value) => expect(validCorrelationId(value)).toBe(false),
);
