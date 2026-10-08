import { it, expect } from 'vitest';
import { catalogRead, priceListScope, requirePriceListManagement } from './catalog-policy.js';
import type { Grant, ResourceContext } from '../../access-control/index.js';
const context = (grants: Grant[]): ResourceContext => ({
  organizationId: 'org',
  membershipId: 'member',
  branches: [{ id: 'A', name: 'A', code: 'A' }],
  grants,
});
const grant = (
  scope: Grant['scope'],
  permissions: Grant['permissions'],
  branchIds: string[] = [],
): Grant => ({ id: scope, roleId: 'r', code: 'r', name: 'r', scope, permissions, branchIds });
it('catalog sharing is explicit and requires products.read', () => {
  expect(catalogRead(context([grant('OWN', ['products.read'])]))).toEqual({
    organizationId: 'org',
  });
  expect(() => catalogRead(context([grant('ORGANIZATION', ['contacts.read'])]))).toThrow(
    'Permission required',
  );
});
it('OWN sees organization lists and linked branches without managing either', () => {
  const c = context([grant('OWN', ['price-lists.read', 'price-lists.manage'])]);
  expect(priceListScope(c)).toEqual({
    organizationId: 'org',
    OR: [{ branchId: null }, { branchId: { in: ['A'] } }],
  });
  expect(() => requirePriceListManagement(c, null)).toThrow();
  expect(() => requirePriceListManagement(c, 'A')).toThrow();
});
it('branch grants intersect current membership branches', () => {
  const c = context([grant('BRANCH_SET', ['price-lists.read', 'price-lists.manage'], ['A', 'B'])]);
  expect(priceListScope(c)).toEqual({
    organizationId: 'org',
    OR: [{ branchId: null }, { branchId: { in: ['A'] } }],
  });
  expect(() => requirePriceListManagement(c, 'A')).not.toThrow();
  expect(() => requirePriceListManagement(c, 'B')).toThrow();
  expect(() => requirePriceListManagement(c, null)).toThrow();
});
it('an unrelated organizational grant never broadens price management', () => {
  const c = context([
    grant('BRANCH', ['price-lists.manage'], ['A']),
    grant('ORGANIZATION', ['products.read', 'price-lists.read']),
  ]);
  expect(() => requirePriceListManagement(c, null)).toThrow();
  expect(() => requirePriceListManagement(c, 'B')).toThrow();
});
it('organization scope covers only the selected tenant for the exact action', () => {
  const c = context([grant('ORGANIZATION', ['price-lists.read', 'price-lists.manage'])]);
  expect(priceListScope(c)).toEqual({ organizationId: 'org' });
  expect(() => requirePriceListManagement(c, null)).not.toThrow();
  expect(() => requirePriceListManagement(c, 'B')).not.toThrow();
});
