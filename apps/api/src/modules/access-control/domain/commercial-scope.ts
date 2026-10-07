import type { PermissionCode } from '@crm/contracts';
import { collectionScope } from './access-policy.js';
import type { TenantContext } from './access-policy.js';
export function commercialScope(context: TenantContext, permission: PermissionCode) {
  const scope = collectionScope(context, permission);
  return {
    organizationId: context.organizationId,
    ...(scope.organization
      ? {}
      : {
          OR: [
            ...(scope.own
              ? [
                  {
                    ownerMembershipId: context.membershipId,
                    branchId: { in: context.branches.map((branch) => branch.id) },
                  },
                ]
              : []),
            ...(scope.branchIds.length ? [{ branchId: { in: scope.branchIds } }] : []),
          ],
        }),
  };
}
export function assignmentScope(context: TenantContext, permission: PermissionCode) {
  const scope = collectionScope(context, permission);
  return {
    branchIds: scope.organization
      ? undefined
      : [
          ...new Set([
            ...scope.branchIds,
            ...(scope.own ? context.branches.map((branch) => branch.id) : []),
          ]),
        ],
    ownOnly: !scope.organization && !scope.branchIds.length,
  };
}
