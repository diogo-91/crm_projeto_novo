import { createHash } from 'node:crypto';
import type { TenantContext } from '../../access-control/index.js';
// Cache invalidation metadata only; it never authorizes a request or replaces live grants.
export function authorizationCacheKey(context: TenantContext): string {
  const grants = context.grants
    .map((grant) => ({
      id: grant.id,
      roleId: grant.roleId,
      scope: grant.scope,
      permissions: [...grant.permissions].sort(),
      branchIds: [...grant.branchIds].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256')
    .update(
      JSON.stringify({
        organizationId: context.organizationId,
        membershipId: context.membershipId,
        branches: context.branches.map((branch) => branch.id).sort(),
        grants,
      }),
    )
    .digest('hex');
}
