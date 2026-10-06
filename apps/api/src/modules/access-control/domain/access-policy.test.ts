import { describe, expect, it } from 'vitest';
import { canDelegate, collectionScope, permits, validateGrant } from './access-policy.js';
import type { Grant, TenantContext } from './access-policy.js';
const base: TenantContext = {
  userId: 'user',
  sessionId: 'session',
  contextVersion: 0,
  membershipId: 'member',
  organizationId: 'org',
  organizationName: 'Org',
  primaryBranchId: null,
  branches: [
    { id: 'a', name: 'A', code: 'A' },
    { id: 'b', name: 'B', code: 'B' },
  ],
  grants: [],
};
const grant = (
  scope: Grant['scope'],
  permissions: Grant['permissions'] = ['users.read'],
  branchIds: string[] = [],
): Grant => ({
  id: 'grant',
  roleId: 'role',
  code: 'SELLER',
  name: 'Seller',
  scope,
  permissions,
  branchIds,
});
describe('same-grant permission and scope policy', () => {
  it('denies missing grants and permissions', () => {
    expect(permits(base, 'users.read')).toBe(false);
    expect(
      permits({ ...base, grants: [grant('ORGANIZATION', ['roles.read'])] }, 'users.read'),
    ).toBe(false);
  });
  it('OWN requires matching owner and an active membership branch when specified', () => {
    const context = { ...base, grants: [grant('OWN')] };
    expect(permits(context, 'users.read', { ownerMembershipId: 'member', branchId: 'a' })).toBe(
      true,
    );
    expect(permits(context, 'users.read', { ownerMembershipId: 'other', branchId: 'a' })).toBe(
      false,
    );
    expect(
      permits(context, 'users.read', { ownerMembershipId: 'member', branchId: 'foreign' }),
    ).toBe(false);
    expect(permits(context, 'users.read')).toBe(false);
    expect(permits(context, 'users.read', { ownerMembershipId: 'member' })).toBe(true);
  });
  it.each(['BRANCH', 'BRANCH_SET'] as const)(
    '%s needs an explicit branch in both grant and membership',
    (scope) => {
      const context = { ...base, grants: [grant(scope, ['users.read'], ['a', 'foreign'])] };
      expect(permits(context, 'users.read', { branchId: 'a' })).toBe(true);
      expect(permits(context, 'users.read', { branchId: 'b' })).toBe(false);
      expect(permits(context, 'users.read', { branchId: 'foreign' })).toBe(false);
      expect(permits(context, 'users.read')).toBe(false);
    },
  );
  it('ORGANIZATION explicitly covers unassigned and future branches for its own permissions', () => {
    const context = { ...base, grants: [grant('ORGANIZATION')] };
    expect(permits(context, 'users.read', { branchId: 'future' })).toBe(true);
    expect(permits(context, 'roles.read', { branchId: 'future' })).toBe(false);
  });
  it('never combines narrow permission with unrelated organization scope', () => {
    const context = {
      ...base,
      grants: [grant('BRANCH', ['users.read'], ['a']), grant('ORGANIZATION', ['roles.read'])],
    };
    expect(permits(context, 'users.read', { branchId: 'b' })).toBe(false);
    expect(collectionScope(context, 'users.read')).toEqual({
      organization: false,
      own: false,
      branchIds: ['a'],
    });
  });
  it('denies delegating broader authority or a missing permission', () => {
    const actor = { ...base, grants: [grant('BRANCH_SET', ['users.read'], ['a', 'b'])] };
    expect(canDelegate(actor, ['users.read'], 'BRANCH', ['a'], 'other')).toBe(true);
    expect(canDelegate(actor, ['users.read'], 'ORGANIZATION', [], 'other')).toBe(false);
    expect(canDelegate(actor, ['users.manage'], 'BRANCH', ['a'], 'other')).toBe(false);
    expect(canDelegate(actor, ['users.read'], 'BRANCH', ['foreign'], 'other')).toBe(false);
  });
  it('rejects invalid scope cardinality and duplicate branch IDs', () => {
    for (const [scope, ids] of [
      ['OWN', ['a']],
      ['ORGANIZATION', ['a']],
      ['BRANCH', []],
      ['BRANCH', ['a', 'b']],
      ['BRANCH_SET', []],
      ['BRANCH_SET', ['a', 'a']],
    ] as const)
      expect(() => validateGrant(scope, [...ids])).toThrow();
    expect(() => validateGrant('BRANCH', ['a'])).not.toThrow();
  });
});
