import { ApplicationError } from '../../../common/application-error.js';
export function validateBranchSelection(branchIds: string[], primaryBranchId?: string): void {
  if (new Set(branchIds).size !== branchIds.length)
    throw new ApplicationError('DUPLICATE_BRANCH', 'Branch identifiers must be distinct.');
  if (primaryBranchId !== undefined && !branchIds.includes(primaryBranchId))
    throw new ApplicationError(
      'INVALID_PRIMARY_BRANCH',
      'The primary branch must be included in branchIds.',
    );
}
export function requireActiveOrganization(organization: { active: boolean } | null): void {
  if (organization === null)
    throw new ApplicationError('ORGANIZATION_NOT_FOUND', 'Organization does not exist.');
  if (!organization.active)
    throw new ApplicationError(
      'ORGANIZATION_INACTIVE',
      'Inactive organizations cannot receive new records.',
    );
}
