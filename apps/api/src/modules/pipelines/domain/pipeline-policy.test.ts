import { it, expect } from 'vitest';
import { pipelineScope } from './pipeline-policy.js';
import type { TenantContext, Grant } from '../../access-control/index.js';
function context(grants: Grant[]): TenantContext {
  return {
    userId: 'u',
    sessionId: 's',
    contextVersion: 1,
    membershipId: 'm',
    organizationId: 'org',
    organizationName: 'O',
    primaryBranchId: 'a',
    branches: [{ id: 'a', name: 'A', code: 'A' }],
    grants,
  };
}
function grant(
  scope: Grant['scope'],
  permissions: Grant['permissions'],
  branchIds: string[] = [],
): Grant {
  return { id: 'g', roleId: 'r', code: 'R', name: 'R', scope, permissions, branchIds };
}
it('organizational catalogs retain tenant even with full scope', () =>
  expect(pipelineScope(context([grant('ORGANIZATION', ['pipelines.read'])]))).toEqual({
    organizationId: 'org',
  }));
it('OWN can use organizational and linked branch pipelines', () =>
  expect(pipelineScope(context([grant('OWN', ['pipelines.read'])]))).toEqual({
    organizationId: 'org',
    OR: [{ branchId: null }, { branchId: { in: ['a'] } }],
  }));
it('branches intersect membership links and do not borrow scope from another permission', () =>
  expect(
    pipelineScope(
      context([
        grant('BRANCH_SET', ['pipelines.read'], ['a', 'b']),
        grant('ORGANIZATION', ['leads.read']),
      ]),
    ),
  ).toHaveProperty('OR'));
it('missing pipeline permission fails closed', () =>
  expect(() => pipelineScope(context([]))).toThrow());
