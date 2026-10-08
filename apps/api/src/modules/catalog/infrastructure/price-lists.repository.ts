import { Inject, Injectable } from '@nestjs/common';
import { normalizeTagName, currencySchema } from '@crm/contracts';
import type {
  CreatePriceList,
  UpdatePriceList,
  SetPrice,
  ListQuery,
  PriceListQuery,
  PriceItemQuery,
  PriceListResponse,
  PriceItemResponse,
} from '@crm/contracts';
import type { Prisma, DatabaseTransaction } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService, collectionScope, permits } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import {
  commercialPage,
  cursorFilter,
  identityPage,
} from '../../../common/commercial-pagination.js';
import {
  catalogRead,
  priceListScope,
  requirePriceListManagement,
} from '../domain/catalog-policy.js';
const columns = {
  id: true,
  name: true,
  currency: true,
  branchId: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.PriceListSelect;
type Row = Prisma.PriceListGetPayload<{ select: typeof columns }>;
type Change =
  | { type: 'rename'; input: UpdatePriceList }
  | { type: 'archive'; version: number }
  | { type: 'price'; productId: string; input: SetPrice }
  | { type: 'remove'; productId: string; version: number };
@Injectable()
export class PriceListsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<PriceListResponse[]> {
    const branches = await this.directory.branchLabels(
      tx,
      context.organizationId,
      rows.flatMap((row) => (row.branchId ? [row.branchId] : [])),
    );
    return rows.map((row) => {
      const branch = row.branchId ? branches.get(row.branchId) : null;
      if (branch === undefined) throw new Error('Price list branch projection missing');
      return {
        id: row.id,
        name: row.name,
        currency: currencySchema.parse(row.currency),
        canManage: permits(
          context,
          'price-lists.manage',
          row.branchId ? { branchId: row.branchId } : {},
        ),
        branch,
        active: row.active,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  async branches(context: TenantContext, query: ListQuery) {
    const scope = collectionScope(context, 'price-lists.manage');
    return {
      ...(await this.directory.branches(
        this.database.client,
        context.organizationId,
        scope.organization ? undefined : scope.branchIds,
        query,
      )),
      organizationAllowed: scope.organization,
    };
  }
  async list(context: TenantContext, query: PriceListQuery) {
    const rows = await this.database.client.priceList.findMany({
      where: {
        AND: [
          priceListScope(context),
          cursorFilter(query),
          {
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.branchId ? { OR: [{ branchId: null }, { branchId: query.branchId }] } : {}),
            ...(query.search
              ? { normalizedName: { contains: normalizeTagName(query.search) } }
              : {}),
          },
        ],
      },
      select: columns,
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(await this.responses(this.database.client, context, rows), query);
  }
  async get(context: TenantContext, id: string) {
    const row = await this.database.client.priceList.findFirst({
      where: { AND: [priceListScope(context), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Price list unavailable.');
    return this.response(this.database.client, context, row);
  }
  private async response(tx: DatabaseTransaction, context: TenantContext, row: Row) {
    const result = (await this.responses(tx, context, [row]))[0];
    if (!result) throw new Error('Price list projection missing');
    return result;
  }
  async items(context: TenantContext, id: string, query: PriceItemQuery) {
    catalogRead(context);
    await this.get(context, id);
    const rows = await this.database.client.priceListItem.findMany({
      where: {
        organizationId: context.organizationId,
        priceListId: id,
        priceList: priceListScope(context),
        ...(query.active ? { active: query.active === 'true' } : {}),
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      select: {
        id: true,
        unitPrice: true,
        active: true,
        updatedAt: true,
        product: { select: { id: true, name: true, sku: true, unit: true, active: true } },
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return identityPage(
      rows.map((row): PriceItemResponse => ({
        id: row.id,
        unitPrice: row.unitPrice.toFixed(6),
        product: row.product,
        active: row.active,
        updatedAt: row.updatedAt.toISOString(),
      })),
      query.limit,
    );
  }
  create(context: TenantContext, input: CreatePriceList) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'price-lists.manage',
          'collection',
        );
        const branchId = input.branchId ?? null;
        requirePriceListManagement(fresh, branchId);
        if (branchId) await this.directory.requireBranch(tx, fresh.organizationId, branchId);
        const row = await tx.priceList.create({
          data: {
            organizationId: fresh.organizationId,
            name: input.name,
            normalizedName: normalizeTagName(input.name),
            currency: input.currency,
            branchId,
            createdByMembershipId: fresh.membershipId,
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        return this.response(tx, fresh, row);
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdatePriceList) {
    return this.mutate(context, id, { type: 'rename', input });
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.mutate(context, id, { type: 'archive', version });
  }
  setPrice(context: TenantContext, id: string, productId: string, input: SetPrice) {
    return this.mutate(context, id, { type: 'price', productId, input });
  }
  removePrice(context: TenantContext, id: string, productId: string, version: number) {
    return this.mutate(context, id, { type: 'remove', productId, version });
  }
  private mutate(context: TenantContext, id: string, change: Change) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'price-lists.manage',
          'collection',
        );
        await tx.$queryRaw`SELECT id FROM price_lists WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const row = await tx.priceList.findFirst({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Price list unavailable.');
        requirePriceListManagement(fresh, row.branchId);
        const version =
          change.type === 'rename' || change.type === 'price'
            ? change.input.expectedVersion
            : change.version;
        if (!row.active || row.version !== version)
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Price list archived or changed. Reload before saving.',
          );
        if (change.type === 'price') {
          catalogRead(fresh);
          await tx.$queryRaw`SELECT id FROM products WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${change.productId}::uuid FOR SHARE`;
          const product = await tx.product.findFirst({
            where: { organizationId: fresh.organizationId, id: change.productId, active: true },
            select: { id: true },
          });
          if (!product)
            throw new ApplicationError('RESOURCE_NOT_FOUND', 'Active product unavailable.');
          await tx.priceListItem.upsert({
            where: {
              organizationId_priceListId_productId: {
                organizationId: fresh.organizationId,
                priceListId: id,
                productId: change.productId,
              },
            },
            create: {
              organizationId: fresh.organizationId,
              priceListId: id,
              productId: change.productId,
              unitPrice: change.input.unitPrice,
              updatedByMembershipId: fresh.membershipId,
            },
            update: {
              unitPrice: change.input.unitPrice,
              active: true,
              updatedByMembershipId: fresh.membershipId,
            },
          });
        }
        if (change.type === 'remove') {
          const result = await tx.priceListItem.updateMany({
            where: {
              organizationId: fresh.organizationId,
              priceListId: id,
              productId: change.productId,
              active: true,
            },
            data: { active: false, updatedByMembershipId: fresh.membershipId },
          });
          if (result.count !== 1)
            throw new ApplicationError('RESOURCE_NOT_FOUND', 'Active price unavailable.');
        }
        const updated = await tx.priceList.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: {
            ...(change.type === 'rename' && change.input.name !== undefined
              ? { name: change.input.name, normalizedName: normalizeTagName(change.input.name) }
              : {}),
            ...(change.type === 'archive' ? { active: false } : {}),
            version: { increment: 1 },
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        return this.response(tx, fresh, updated);
      }),
    );
  }
}
