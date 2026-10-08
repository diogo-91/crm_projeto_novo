import { it, expect } from 'vitest';
import {
  createQuoteSchema,
  updateQuoteSchema,
  idempotencyKeySchema,
  quoteQuerySchema,
} from './quotes.js';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input = {
  name: ' Quote ',
  branchId: id,
  contactId: id,
  priceListId: id,
  items: [{ productId: id, quantity: '1' }],
};
it('normalizes transport input without accepting client calculated amounts', () => {
  expect(createQuoteSchema.parse(input)).toMatchObject({
    name: 'Quote',
    items: [{ discountPercent: '0' }],
  });
  for (const extra of [
    { total: '0' },
    { organizationId: id },
    { status: 'APPROVED' },
    { ownerMembershipId: id },
    { approvedByMembershipId: id },
  ])
    expect(createQuoteSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
it('requires exactly one buyer', () => {
  expect(createQuoteSchema.safeParse({ ...input, contactId: null }).success).toBe(false);
  expect(createQuoteSchema.safeParse({ ...input, companyId: id }).success).toBe(false);
});
it('rejects duplicate items and invalid quantity/discount', () => {
  expect(
    createQuoteSchema.safeParse({ ...input, items: [...input.items, ...input.items] }).success,
  ).toBe(false);
  for (const line of [
    { quantity: '0' },
    { quantity: '1e3' },
    { quantity: '1.0000001' },
    { quantity: '1', discountPercent: '100.01' },
  ])
    expect(
      createQuoteSchema.safeParse({ ...input, items: [{ productId: id, ...line }] }).success,
    ).toBe(false);
});
it('requires optimistic version and prevents changing buyer or currency in drafts', () => {
  expect(updateQuoteSchema.safeParse({ items: input.items }).success).toBe(false);
  expect(
    updateQuoteSchema.safeParse({ items: input.items, expectedVersion: 1, currency: 'USD' })
      .success,
  ).toBe(false);
});
it('validates keys, date-only validity and opaque list cursor', () => {
  expect(idempotencyKeySchema.safeParse('short').success).toBe(false);
  expect(idempotencyKeySchema.safeParse(id).success).toBe(true);
  expect(createQuoteSchema.safeParse({ ...input, validUntil: '2026-02-30' }).success).toBe(false);
  expect(quoteQuerySchema.safeParse({ cursor: 'opaque-position' }).success).toBe(true);
});
