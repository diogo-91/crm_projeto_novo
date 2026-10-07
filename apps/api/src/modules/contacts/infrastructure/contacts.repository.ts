import { Inject, Injectable } from '@nestjs/common';
import { normalizePhone, normalizeDocument } from '@crm/contracts';
import type {
  CreateContact,
  UpdateContact,
  ContactListQuery,
  ContactResponse,
  AssignmentQuery,
  PermissionCode,
} from '@crm/contracts';
import {
  AccessControlService,
  commercialScope,
  assignmentScope,
  permits,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { CompaniesLookupGateway } from '../../companies/index.js';
import { TagsLookupGateway } from '../../tags/index.js';
import { DatabaseService } from '../../database/database.module.js';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
const columns = {
  id: true,
  name: true,
  branchId: true,
  ownerMembershipId: true,
  companyId: true,
  phone: true,
  email: true,
  document: true,
  notes: true,
  source: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
type Row = Prisma.ContactGetPayload<{ select: typeof columns }>;
@Injectable()
export class ContactsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
    @Inject(CompaniesLookupGateway) private readonly companies: CompaniesLookupGateway,
    @Inject(TagsLookupGateway) private readonly tags: TagsLookupGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<ContactResponse[]> {
    const [labels, companies, tags] = await Promise.all([
      this.directory.labels(tx, context.organizationId, rows),
      this.companies.labels(
        tx,
        context,
        rows.flatMap((row) => (row.companyId ? [row.companyId] : [])),
      ),
      this.tags.labels(
        tx,
        context,
        rows.map((row) => row.id),
      ),
    ]);
    return rows.map((row) => {
      const branch = labels.branches.get(row.branchId);
      const owner = labels.owners.get(row.ownerMembershipId);
      if (!branch || !owner) throw new Error('Contact assignment missing');
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        document: row.document,
        notes: row.notes,
        source: row.source,
        active: row.active,
        version: row.version,
        branch,
        owner,
        company: row.companyId ? (companies.get(row.companyId) ?? null) : null,
        tags: tags.get(row.id) ?? [],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  private async response(
    tx: DatabaseTransaction,
    context: TenantContext,
    row: Row,
  ): Promise<ContactResponse> {
    const response = (await this.responses(tx, context, [row]))[0];
    if (!response) throw new Error('Contact projection missing');
    return response;
  }
  async get(context: TenantContext, id: string) {
    const tx = this.database.client;
    const row = await tx.contact.findFirst({
      where: { AND: [commercialScope(context, 'contacts.read'), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Contact unavailable.');
    return this.response(tx, context, row);
  }
  async list(context: TenantContext, query: ContactListQuery) {
    const tx = this.database.client;
    if (query.companyId) await this.companies.requireLink(tx, context, query.companyId, false);
    if (query.tagId) await this.tags.requireLinks(tx, context, [query.tagId], false);
    const where: Prisma.ContactWhereInput = {
      AND: [
        commercialScope(context, 'contacts.read'),
        cursorFilter(query),
        {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
          ...(query.active ? { active: query.active === 'true' } : {}),
          ...(query.source ? { source: query.source } : {}),
          ...(query.companyId ? { companyId: query.companyId } : {}),
          ...(query.tagId
            ? { tags: { some: { organizationId: context.organizationId, tagId: query.tagId } } }
            : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                  ...(normalizePhone(query.search)
                    ? [{ normalizedPhone: { contains: normalizePhone(query.search) } }]
                    : []),
                  ...(normalizeDocument(query.search)
                    ? [{ normalizedDocument: { contains: normalizeDocument(query.search) } }]
                    : []),
                ],
              }
            : {}),
        },
      ],
    };
    const rows = await tx.contact.findMany({
      where,
      select: columns,
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(await this.responses(tx, context, rows), query);
  }
  create(context: TenantContext, input: CreateContact) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'contacts.create',
          'collection',
        );
        const ownerMembershipId = input.ownerMembershipId ?? fresh.membershipId;
        this.destination(fresh, 'contacts.create', input.branchId, ownerMembershipId);
        if (ownerMembershipId !== fresh.membershipId)
          this.destination(fresh, 'contacts.assign', input.branchId, ownerMembershipId);
        await this.directory.assignment(
          tx,
          fresh.organizationId,
          input.branchId,
          ownerMembershipId,
        );
        if (input.companyId) await this.companies.requireLink(tx, fresh, input.companyId);
        await this.tags.requireLinks(tx, fresh, input.tagIds);
        const row = await tx.contact.create({
          data: {
            organizationId: fresh.organizationId,
            branchId: input.branchId,
            ownerMembershipId,
            name: input.name,
            phone: input.phone,
            normalizedPhone: normalizePhone(input.phone),
            email: input.email ?? null,
            document: input.document ?? null,
            normalizedDocument: input.document ? normalizeDocument(input.document) : null,
            notes: input.notes ?? null,
            source: input.source,
            companyId: input.companyId ?? null,
            createdByMembershipId: fresh.membershipId,
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        await this.replaceTags(tx, fresh, row.id, input.tagIds);
        return this.response(tx, fresh, row);
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdateContact) {
    return this.change(context, id, input.expectedVersion, 'contacts.update', input);
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.change(context, id, version, 'contacts.delete');
  }
  private destination(
    context: TenantContext,
    permission: PermissionCode,
    branchId: string,
    ownerMembershipId: string,
  ) {
    if (!permits(context, permission, { branchId, ownerMembershipId }))
      throw new ApplicationError('FORBIDDEN', 'Assignment exceeds action scope.');
  }
  private async replaceTags(
    tx: DatabaseTransaction,
    context: TenantContext,
    id: string,
    ids: string[],
  ) {
    await tx.contactTag.deleteMany({
      where: { organizationId: context.organizationId, contactId: id },
    });
    if (ids.length)
      await tx.contactTag.createMany({
        data: ids.map((tagId) => ({
          organizationId: context.organizationId,
          contactId: id,
          tagId,
        })),
      });
  }
  private change(
    context: TenantContext,
    id: string,
    version: number,
    permission: 'contacts.update' | 'contacts.delete',
    input?: UpdateContact,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, permission, 'collection');
        const where = { AND: [commercialScope(fresh, permission), { id }] };
        const current = await tx.contact.findFirst({ where, select: columns });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Contact unavailable.');
        if (current.version !== version)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        const branchId = input?.branchId ?? current.branchId;
        const ownerMembershipId = input?.ownerMembershipId ?? current.ownerMembershipId;
        this.destination(fresh, permission, branchId, ownerMembershipId);
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          this.destination(fresh, 'contacts.assign', current.branchId, current.ownerMembershipId);
          this.destination(fresh, 'contacts.assign', branchId, ownerMembershipId);
          await this.directory.assignment(tx, fresh.organizationId, branchId, ownerMembershipId);
        }
        if (input?.companyId) await this.companies.requireLink(tx, fresh, input.companyId);
        if (input?.tagIds) await this.tags.requireLinks(tx, fresh, input.tagIds);
        const changed = await tx.contact.updateMany({
          where: { AND: [where, { version }] },
          data: {
            branchId,
            ownerMembershipId,
            version: { increment: 1 },
            updatedByMembershipId: fresh.membershipId,
            ...(input
              ? {
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.phone !== undefined
                    ? { phone: input.phone, normalizedPhone: normalizePhone(input.phone) }
                    : {}),
                  ...(input.email !== undefined ? { email: input.email } : {}),
                  ...(input.document !== undefined
                    ? {
                        document: input.document,
                        normalizedDocument: input.document
                          ? normalizeDocument(input.document)
                          : null,
                      }
                    : {}),
                  ...(input.notes !== undefined ? { notes: input.notes } : {}),
                  ...(input.source !== undefined ? { source: input.source } : {}),
                  ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
                }
              : { active: false }),
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          await tx.contactAssignmentHistory.create({
            data: {
              organizationId: fresh.organizationId,
              contactId: id,
              fromBranchId: current.branchId,
              toBranchId: branchId,
              fromOwnerMembershipId: current.ownerMembershipId,
              toOwnerMembershipId: ownerMembershipId,
              actorMembershipId: fresh.membershipId,
              recordVersion: current.version + 1,
            },
          });
        }
        if (input?.tagIds) await this.replaceTags(tx, fresh, id, input.tagIds);
        const row = await tx.contact.findFirstOrThrow({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        return this.response(tx, fresh, row);
      }),
    );
  }
  async branches(context: TenantContext, query: AssignmentQuery) {
    const scope = assignmentScope(context, `contacts.${query.action}`);
    return this.directory.branches(
      this.database.client,
      context.organizationId,
      scope.branchIds,
      query,
    );
  }
  async owners(context: TenantContext, query: AssignmentQuery) {
    if (!query.branchId) throw new ApplicationError('INVALID_INPUT', 'Branch selection required.');
    const scope = assignmentScope(context, `contacts.${query.action}`);
    if (scope.branchIds && !scope.branchIds.includes(query.branchId))
      throw new ApplicationError('FORBIDDEN', 'Branch outside action scope.');
    const canAssign = permits(context, 'contacts.assign', { branchId: query.branchId });
    return this.directory.owners(
      this.database.client,
      context.organizationId,
      query.branchId,
      scope.ownOnly || (query.action !== 'read' && !canAssign) ? context.membershipId : undefined,
      query,
    );
  }
}
