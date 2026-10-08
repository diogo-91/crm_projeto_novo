import { collectionScope, permits } from '../../access-control/index.js';
import type { ResourceContext } from '../../access-control/index.js';
import { ApplicationError } from '../../../common/application-error.js';
export function catalogRead(context: ResourceContext) {
  collectionScope(context, 'products.read');
  return { organizationId: context.organizationId };
}
export function priceListScope(context: ResourceContext) {
  const scope = collectionScope(context, 'price-lists.read');
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
export function requirePriceListManagement(context: ResourceContext, branchId: string | null) {
  if (!permits(context, 'price-lists.manage', branchId ? { branchId } : {}))
    throw new ApplicationError('FORBIDDEN', 'Price list management scope required.');
}
