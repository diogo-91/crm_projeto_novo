import { Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { catalogRead, priceListScope } from '../domain/catalog-policy.js';
@Injectable()
export class CatalogLookupGateway {
  async quotePrices(
    tx: DatabaseTransaction,
    context: TenantContext,
    id: string,
    branchId: string,
    productIds: string[],
  ) {
    catalogRead(context);
    // Same lock order as list mutations: list, then products (sorted to avoid inversion).
    await tx.$queryRaw`SELECT id FROM price_lists WHERE organization_id = ${context.organizationId}::uuid AND id = ${id}::uuid FOR SHARE`;
    const list = await tx.priceList.findFirst({
      where: { AND: [priceListScope(context), { id, active: true }] },
      select: { id: true, name: true, currency: true, branchId: true },
    });
    if (!list || (list.branchId !== null && list.branchId !== branchId))
      throw new ApplicationError('RESOURCE_NOT_FOUND', 'Price list unavailable for quote branch.');
    for (const productId of [...productIds].sort())
      await tx.$queryRaw`SELECT id FROM products WHERE organization_id = ${context.organizationId}::uuid AND id = ${productId}::uuid FOR SHARE`;
    const rows = await tx.priceListItem.findMany({
      where: {
        organizationId: context.organizationId,
        priceListId: id,
        productId: { in: productIds },
        active: true,
        product: { active: true },
      },
      select: {
        productId: true,
        unitPrice: true,
        product: { select: { name: true, sku: true, unit: true } },
      },
    });
    if (rows.length !== productIds.length)
      throw new ApplicationError('RESOURCE_NOT_FOUND', 'Active product price unavailable.');
    return {
      list,
      products: new Map(
        rows.map((row) => [
          row.productId,
          {
            productId: row.productId,
            description: row.product.name,
            sku: row.product.sku,
            unit: row.product.unit,
            unitPrice: row.unitPrice.toFixed(6),
          },
        ]),
      ),
    };
  }
}
