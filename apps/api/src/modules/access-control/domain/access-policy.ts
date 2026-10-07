import type { PermissionCode, TenantScope } from '@crm/contracts';
import { ApplicationError } from '../../../common/application-error.js';
export type Grant = {
  id: string;
  roleId: string;
  code: string;
  name: string;
  scope: TenantScope;
  permissions: PermissionCode[];
  branchIds: string[];
};
export type TenantContext = {
  userId: string;
  sessionId: string;
  contextVersion: number;
  membershipId: string;
  organizationId: string;
  organizationName: string;
  primaryBranchId: string | null;
  branches: { id: string; code: string; name: string }[];
  grants: Grant[];
};
export type ResourceContext = Pick<
  TenantContext,
  'organizationId' | 'membershipId' | 'branches' | 'grants'
>;
export function permits(
  context: ResourceContext,
  permission: PermissionCode,
  resource: { branchId?: string; ownerMembershipId?: string } = {},
): boolean {
  return context.grants.some((grant) => {
    if (!grant.permissions.includes(permission)) return false;
    if (grant.scope === 'ORGANIZATION') return true;
    if (grant.scope === 'OWN')
      return (
        resource.ownerMembershipId === context.membershipId &&
        (resource.branchId === undefined ||
          context.branches.some((branch) => branch.id === resource.branchId))
      );
    if (
      resource.branchId === undefined ||
      !context.branches.some((branch) => branch.id === resource.branchId)
    )
      return false;
    return grant.branchIds.includes(resource.branchId);
  });
}
export function orgPermission(context: ResourceContext, permission: PermissionCode) {
  if (!permits(context, permission))
    throw new ApplicationError('FORBIDDEN', 'Permission and organization scope required.');
}
export function collectionScope(
  context: ResourceContext,
  permission: PermissionCode,
  required = true,
) {
  const grants = context.grants.filter((grant) => grant.permissions.includes(permission));
  const organization = grants.some((grant) => grant.scope === 'ORGANIZATION');
  const own = grants.some((grant) => grant.scope === 'OWN');
  const allowed = new Set(context.branches.map((branch) => branch.id));
  const branchIds = [
    ...new Set(
      grants
        .filter((grant) => grant.scope === 'BRANCH' || grant.scope === 'BRANCH_SET')
        .flatMap((grant) => grant.branchIds),
    ),
  ].filter((id) => allowed.has(id));
  if (required && !organization && !own && branchIds.length === 0)
    throw new ApplicationError('FORBIDDEN', 'Permission required.');
  return { organization, own, branchIds };
}
export function validateGrant(scope: TenantScope, branches: string[]): void {
  if (
    new Set(branches).size !== branches.length ||
    (scope === 'BRANCH' && branches.length !== 1) ||
    (scope === 'BRANCH_SET' && branches.length < 1) ||
    ((scope === 'OWN' || scope === 'ORGANIZATION') && branches.length !== 0)
  )
    throw new ApplicationError('INVALID_INPUT', 'Branch selection does not match grant scope.');
}
export function canDelegate(
  actor: TenantContext,
  permissions: PermissionCode[],
  scope: TenantScope,
  branches: string[],
  targetMembershipId: string,
): boolean {
  return permissions.every((permission) =>
    actor.grants.some((grant) => {
      if (!grant.permissions.includes(permission)) return false;
      if (grant.scope === 'ORGANIZATION') return true;
      if (scope === 'ORGANIZATION') return false;
      if (scope === 'OWN')
        return grant.scope === 'OWN' && targetMembershipId === actor.membershipId;
      if (grant.scope !== 'BRANCH' && grant.scope !== 'BRANCH_SET') return false;
      return branches.every(
        (id) => grant.branchIds.includes(id) && actor.branches.some((branch) => branch.id === id),
      );
    }),
  );
}
