import { it, expect } from 'vitest';
import {
  createProductSchema,
  updateProductSchema,
  createPriceListSchema,
  updatePriceListSchema,
  setPriceSchema,
  productListQuerySchema,
  priceItemQuerySchema,
} from './catalog.js';
const product = { name: ' Product ', sku: ' sku-01 ', unit: ' UN ' };
it('normalizes product SKU and trims text without trusting the frontend', () => {
  expect(createProductSchema.parse(product)).toEqual({
    name: 'Product',
    sku: 'SKU-01',
    unit: 'UN',
  });
});
it.each(['', 'A B', '../x', 'SKU/1'])('rejects invalid SKU %s', (sku) => {
  expect(createProductSchema.safeParse({ ...product, sku }).success).toBe(false);
});
it('rejects tenant, active and author mass assignment', () => {
  for (const extra of [
    { organizationId: 'tenant' },
    { active: true },
    { updatedByMembershipId: 'member' },
  ])
    expect(createProductSchema.safeParse({ ...product, ...extra }).success).toBe(false);
});
it('requires optimistic versions and prevents changing list currency or branch', () => {
  expect(updateProductSchema.safeParse({ name: 'New' }).success).toBe(false);
  expect(updateProductSchema.safeParse({ unit: 'BOX', expectedVersion: 1 }).success).toBe(false);
  for (const extra of [{ currency: 'USD' }, { branchId: null }])
    expect(updatePriceListSchema.safeParse({ expectedVersion: 1, ...extra }).success).toBe(false);
});
it.each(['0', '0.000001', '999999999999.999999'])(
  'accepts exact decimal unit price %s',
  (unitPrice) => {
    expect(setPriceSchema.parse({ expectedVersion: 1, unitPrice }).unitPrice).toBe(unitPrice);
  },
);
it.each(['-1', '1e3', '1,99', '1.0000001', '1000000000000', 'NaN'])(
  'rejects invalid or oversized unit price %s',
  (unitPrice) => {
    expect(setPriceSchema.safeParse({ expectedVersion: 1, unitPrice }).success).toBe(false);
  },
);
it('rejects numeric financial input and unsupported currency', () => {
  expect(setPriceSchema.safeParse({ expectedVersion: 1, unitPrice: 1.1 }).success).toBe(false);
  expect(createPriceListSchema.safeParse({ name: 'List', currency: 'JPY' }).success).toBe(false);
});
it('bounds catalog and item pagination and disallows wallet filters', () => {
  expect(productListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  expect(productListQuerySchema.safeParse({ ownerMembershipId: 'owner' }).success).toBe(false);
  expect(priceItemQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
});
