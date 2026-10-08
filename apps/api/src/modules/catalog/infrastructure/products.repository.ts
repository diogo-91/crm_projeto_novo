import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateProduct,
  UpdateProduct,
  ProductListQuery,
  ProductResponse,
} from '@crm/contracts';
import type { Prisma, DatabaseTransaction } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { catalogRead } from '../domain/catalog-policy.js';
const columns = {
  id: true,
  name: true,
  sku: true,
  unit: true,
  description: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ProductSelect;
type Row = Prisma.ProductGetPayload<{ select: typeof columns }>;
function response(row: Row): ProductResponse {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
@Injectable()
export class ProductsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  async list(context: TenantContext, query: ProductListQuery) {
    const rows = await this.database.client.product.findMany({
      where: {
        AND: [
          catalogRead(context),
          cursorFilter(query),
          {
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.search
              ? {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { sku: { contains: query.search.toUpperCase() } },
                  ],
                }
              : {}),
          },
        ],
      },
      select: columns,
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(rows.map(response), query);
  }
  async get(context: TenantContext, id: string) {
    const row = await this.database.client.product.findFirst({
      where: { ...catalogRead(context), id },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Product unavailable.');
    return response(row);
  }
  create(context: TenantContext, input: CreateProduct) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'products.manage');
        const row = await tx.product.create({
          data: {
            organizationId: fresh.organizationId,
            name: input.name,
            sku: input.sku,
            unit: input.unit,
            description: input.description ?? null,
            createdByMembershipId: fresh.membershipId,
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        return response(row);
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdateProduct) {
    return this.mutate(context, id, input.expectedVersion, (tx, fresh) =>
      tx.product.update({
        where: { organizationId_id: { organizationId: fresh.organizationId, id } },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          version: { increment: 1 },
          updatedByMembershipId: fresh.membershipId,
        },
        select: columns,
      }),
    );
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.mutate(context, id, version, (tx, fresh) =>
      tx.product.update({
        where: { organizationId_id: { organizationId: fresh.organizationId, id } },
        data: {
          active: false,
          version: { increment: 1 },
          updatedByMembershipId: fresh.membershipId,
        },
        select: columns,
      }),
    );
  }
  private mutate(
    context: TenantContext,
    id: string,
    version: number,
    operation: (tx: DatabaseTransaction, fresh: TenantContext) => Promise<Row>,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'products.manage');
        await tx.$queryRaw`SELECT id FROM products WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const row = await tx.product.findFirst({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Product unavailable.');
        if (!row.active || row.version !== version)
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Product archived or changed. Reload before saving.',
          );
        return response(await operation(tx, fresh));
      }),
    );
  }
}
