import { it, expect } from 'vitest';
import { authorizationCacheKey } from './authorization-cache-key.js';
import type { TenantContext } from '../../access-control/index.js';
const context: TenantContext = {
  userId: 'u',
  sessionId: 's',
  contextVersion: 1,
  membershipId: 'm',
  organizationId: 'o',
  organizationName: 'Org',
  primaryBranchId: 'a',
  branches: [
    { id: 'a', code: 'A', name: 'A' },
    { id: 'b', code: 'B', name: 'B' },
  ],
  grants: [
    {
      id: 'g',
      roleId: 'r',
      code: 'R',
      name: 'Role',
      scope: 'BRANCH_SET',
      permissions: ['contacts.read', 'contacts.update'],
      branchIds: ['a', 'b'],
    },
  ],
};
it('is stable across ordering of permissions and branches', () => {
  const key = authorizationCacheKey(context);
  expect(
    authorizationCacheKey({
      ...context,
      branches: [...context.branches].reverse(),
      grants: context.grants.map((grant) => ({
        ...grant,
        permissions: [...grant.permissions].reverse(),
        branchIds: [...grant.branchIds].reverse(),
      })),
    }),
  ).toBe(key);
});
it('changes when grant branches narrow despite identical permission codes', () =>
  expect(
    authorizationCacheKey({
      ...context,
      grants: context.grants.map((grant) => ({ ...grant, branchIds: ['a'] })),
    }),
  ).not.toBe(authorizationCacheKey(context)));
it('changes for a new tenant or membership', () => {
  expect(authorizationCacheKey({ ...context, organizationId: 'other' })).not.toBe(
    authorizationCacheKey(context),
  );
  expect(authorizationCacheKey({ ...context, membershipId: 'other' })).not.toBe(
    authorizationCacheKey(context),
  );
});
it('does not serialize grant, token or customer data into cache metadata', () =>
  expect(authorizationCacheKey(context)).toMatch(/^[a-f0-9]{64}$/));
