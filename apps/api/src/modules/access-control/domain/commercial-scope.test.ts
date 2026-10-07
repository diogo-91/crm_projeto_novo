import { it, expect } from 'vitest';
import { commercialScope, assignmentScope } from './commercial-scope.js';
import type { TenantContext, Grant } from './access-policy.js';
function context(grants: Grant[]): TenantContext {
  return {
    userId: 'u',
    sessionId: 's',
    contextVersion: 1,
    membershipId: 'm',
    organizationId: 'org',
    organizationName: 'Org',
    primaryBranchId: 'a',
    branches: [{ id: 'a', code: 'A', name: 'A' }],
    grants,
  };
}
function grant(
  scope: Grant['scope'],
  permissions: Grant['permissions'],
  branchIds: string[] = [],
): Grant {
  return { id: 'g', roleId: 'r', code: 'Role', name: 'Role', scope, permissions, branchIds };
}
it('OWN filters owner and active membership branches in SQL predicate', () =>
  expect(commercialScope(context([grant('OWN', ['contacts.read'])]), 'contacts.read')).toEqual({
    organizationId: 'org',
    OR: [{ ownerMembershipId: 'm', branchId: { in: ['a'] } }],
  }));
it('does not combine broad scope from another action', () =>
  expect(
    commercialScope(
      context([grant('OWN', ['contacts.read']), grant('ORGANIZATION', ['companies.read'])]),
      'contacts.read',
    ),
  ).toHaveProperty('OR'));
it('branch set intersects membership branches', () =>
  expect(
    commercialScope(context([grant('BRANCH_SET', ['contacts.read'], ['a', 'b'])]), 'contacts.read'),
  ).toEqual({ organizationId: 'org', OR: [{ branchId: { in: ['a'] } }] }));
it('organization removes resource restrictions but preserves tenant', () =>
  expect(
    commercialScope(context([grant('ORGANIZATION', ['contacts.read'])]), 'contacts.read'),
  ).toEqual({ organizationId: 'org' }));
it('missing action fails closed', () =>
  expect(() => commercialScope(context([]), 'contacts.read')).toThrow());
it('OWN assignment permits only own membership within linked branches', () =>
  expect(assignmentScope(context([grant('OWN', ['contacts.create'])]), 'contacts.create')).toEqual({
    branchIds: ['a'],
    ownOnly: true,
  }));
