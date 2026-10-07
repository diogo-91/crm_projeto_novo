import { collectionScope } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
export function pipelineScope(context: TenantContext) {
  const scope = collectionScope(context, 'pipelines.read');
  return {
    organizationId: context.organizationId,
    ...(scope.organization
      ? {}
      : {
          OR: [
            { branchId: null },
            {
              branchId: {
                in: [
                  ...new Set([
                    ...scope.branchIds,
                    ...(scope.own ? context.branches.map((branch) => branch.id) : []),
                  ]),
                ],
              },
            },
          ],
        }),
  };
}
