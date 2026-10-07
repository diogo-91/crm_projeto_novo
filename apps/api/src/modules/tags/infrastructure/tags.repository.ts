import { Inject, Injectable } from '@nestjs/common';
import { normalizeTagName, tagResponseSchema } from '@crm/contracts';
import type { CreateTag, UpdateTag, TagListQuery } from '@crm/contracts';
import type { DatabaseTransaction } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService, collectionScope } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { persist } from '../../../common/persistence-errors.js';
import { ApplicationError } from '../../../common/application-error.js';
import { identityPage } from '../../../common/commercial-pagination.js';
const columns = {
  id: true,
  name: true,
  variant: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
@Injectable()
export class TagsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  private response(row: {
    id: string;
    name: string;
    variant: string;
    active: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return tagResponseSchema.parse({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  async list(context: TenantContext, query: TagListQuery) {
    collectionScope(context, 'tags.read');
    const rows = await this.database.client.tag.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
        ...(query.active ? { active: query.active === 'true' } : {}),
        ...(query.search ? { normalizedName: { contains: normalizeTagName(query.search) } } : {}),
      },
      select: columns,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return identityPage(
      rows.map((row) => this.response(row)),
      query.limit,
    );
  }
  async requireLinks(
    tx: DatabaseTransaction,
    context: TenantContext,
    ids: string[],
    activeOnly = true,
  ) {
    if (!ids.length) return;
    collectionScope(context, 'tags.read');
    const count = await tx.tag.count({
      where: {
        organizationId: context.organizationId,
        id: { in: ids },
        ...(activeOnly ? { active: true } : {}),
      },
    });
    if (count !== ids.length)
      throw new ApplicationError('RESOURCE_NOT_FOUND', 'Tag unavailable for association.');
  }
  async labels(tx: DatabaseTransaction, context: TenantContext, contactIds: string[]) {
    if (!context.grants.some((grant) => grant.permissions.includes('tags.read')))
      return new Map<string, ReturnType<TagsRepository['response']>[]>();
    const links = await tx.contactTag.findMany({
      where: { organizationId: context.organizationId, contactId: { in: contactIds } },
      select: { contactId: true, tag: { select: columns } },
      orderBy: { tagId: 'asc' },
    });
    const result = new Map<string, ReturnType<TagsRepository['response']>[]>();
    for (const link of links)
      result.set(link.contactId, [...(result.get(link.contactId) ?? []), this.response(link.tag)]);
    return result;
  }
  create(context: TenantContext, input: CreateTag) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'tags.manage');
        return this.response(
          await tx.tag.create({
            data: {
              organizationId: fresh.organizationId,
              name: input.name,
              normalizedName: normalizeTagName(input.name),
              variant: input.variant,
            },
            select: columns,
          }),
        );
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdateTag) {
    return this.change(context, id, input.expectedVersion, input);
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.change(context, id, version);
  }
  private change(context: TenantContext, id: string, version: number, input?: UpdateTag) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'tags.manage');
        const row = await tx.tag.findFirst({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Tag unavailable.');
        const changed = await tx.tag.updateMany({
          where: { organizationId: fresh.organizationId, id, version },
          data: {
            version: { increment: 1 },
            ...(input
              ? {
                  ...(input.name !== undefined
                    ? { name: input.name, normalizedName: normalizeTagName(input.name) }
                    : {}),
                  ...(input.variant !== undefined ? { variant: input.variant } : {}),
                }
              : { active: false }),
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Tag changed. Reload before saving.');
        return this.response(
          await tx.tag.findFirstOrThrow({
            where: { organizationId: fresh.organizationId, id },
            select: columns,
          }),
        );
      }),
    );
  }
}
