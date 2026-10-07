import { Inject, Injectable } from '@nestjs/common';
import { normalizePhone, normalizeDocument } from '@crm/contracts';
import type {
  CreateCompany,
  UpdateCompany,
  CompanyListQuery,
  CompanyResponse,
  AssignmentQuery,
  PermissionCode,
} from '@crm/contracts';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import {
  AccessControlService,
  commercialScope,
  assignmentScope,
  permits,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { DatabaseService } from '../../database/database.module.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
const columns = {
  id: true,
  name: true,
  branchId: true,
  ownerMembershipId: true,
  phone: true,
  email: true,
  document: true,
  notes: true,
  legalName: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
type Row = Prisma.CompanyGetPayload<{ select: typeof columns }>;
@Injectable()
export class CompaniesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
  ) {}
  async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<CompanyResponse[]> {
    const labels = await this.directory.labels(tx, context.organizationId, rows);
    return rows.map((row) => {
      const branch = labels.branches.get(row.branchId);
      const owner = labels.owners.get(row.ownerMembershipId);
      if (!branch || !owner) throw new Error('Company assignment missing');
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        document: row.document,
        notes: row.notes,
        legalName: row.legalName,
        active: row.active,
        version: row.version,
        branch,
        owner,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  private async response(
    tx: DatabaseTransaction,
    context: TenantContext,
    row: Row,
  ): Promise<CompanyResponse> {
    const response = (await this.responses(tx, context, [row]))[0];
    if (!response) throw new Error('Company projection missing');
    return response;
  }
  async get(context: TenantContext, id: string) {
    const tx = this.database.client;
    const row = await tx.company.findFirst({
      where: { AND: [commercialScope(context, 'companies.read'), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Company unavailable.');
    return this.response(tx, context, row);
  }
  async list(context: TenantContext, query: CompanyListQuery) {
    const tx = this.database.client;
    const where: Prisma.CompanyWhereInput = {
      AND: [
        commercialScope(context, 'companies.read'),
        cursorFilter(query),
        {
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
          ...(query.active ? { active: query.active === 'true' } : {}),
          ...(query.document ? { normalizedDocument: normalizeDocument(query.document) } : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { legalName: { contains: query.search, mode: 'insensitive' } },
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
    const rows = await tx.company.findMany({
      where,
      select: columns,
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(await this.responses(tx, context, rows), query);
  }
  async visibleMany(tx: DatabaseTransaction, context: TenantContext, ids: string[]) {
    if (!context.grants.some((grant) => grant.permissions.includes('companies.read')))
      return new Map<string, { id: string; name: string }>();
    const rows = await tx.company.findMany({
      where: { AND: [commercialScope(context, 'companies.read'), { id: { in: ids } }] },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }
  async requireLink(
    tx: DatabaseTransaction,
    context: TenantContext,
    id: string,
    activeOnly = true,
  ) {
    const row = await tx.company.findFirst({
      where: {
        AND: [
          commercialScope(context, 'companies.read'),
          { id, ...(activeOnly ? { active: true } : {}) },
        ],
      },
      select: { id: true },
    });
    if (!row)
      throw new ApplicationError('RESOURCE_NOT_FOUND', 'Company unavailable for association.');
  }
  create(context: TenantContext, input: CreateCompany) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'companies.create',
          'collection',
        );
        return this.createInTransaction(tx, fresh, input);
      }),
    );
  }
  async createInTransaction(tx: DatabaseTransaction, context: TenantContext, input: CreateCompany) {
    const ownerMembershipId = input.ownerMembershipId ?? context.membershipId;
    this.destination(context, 'companies.create', input.branchId, ownerMembershipId);
    if (ownerMembershipId !== context.membershipId)
      this.destination(context, 'companies.assign', input.branchId, ownerMembershipId);
    await this.directory.assignment(tx, context.organizationId, input.branchId, ownerMembershipId);
    const row = await tx.company.create({
      data: {
        organizationId: context.organizationId,
        branchId: input.branchId,
        ownerMembershipId,
        name: input.name,
        phone: input.phone ?? null,
        normalizedPhone: input.phone ? normalizePhone(input.phone) : null,
        email: input.email ?? null,
        document: input.document ?? null,
        normalizedDocument: input.document ? normalizeDocument(input.document) : null,
        legalName: input.legalName ?? null,
        notes: input.notes ?? null,
        createdByMembershipId: context.membershipId,
        updatedByMembershipId: context.membershipId,
      },
      select: columns,
    });
    return this.response(tx, context, row);
  }
  update(context: TenantContext, id: string, input: UpdateCompany) {
    return this.change(context, id, input.expectedVersion, 'companies.update', input);
  }
  archive(context: TenantContext, id: string, expectedVersion: number) {
    return this.change(context, id, expectedVersion, 'companies.delete');
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
  private change(
    context: TenantContext,
    id: string,
    expectedVersion: number,
    permission: 'companies.update' | 'companies.delete',
    input?: UpdateCompany,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, permission, 'collection');
        const where = { AND: [commercialScope(fresh, permission), { id }] };
        const current = await tx.company.findFirst({ where, select: columns });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Company unavailable.');
        if (current.version !== expectedVersion)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        const branchId = input?.branchId ?? current.branchId;
        const ownerMembershipId = input?.ownerMembershipId ?? current.ownerMembershipId;
        this.destination(fresh, permission, branchId, ownerMembershipId);
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          this.destination(fresh, 'companies.assign', current.branchId, current.ownerMembershipId);
          this.destination(fresh, 'companies.assign', branchId, ownerMembershipId);
          await this.directory.assignment(tx, fresh.organizationId, branchId, ownerMembershipId);
        }
        const changed = await tx.company.updateMany({
          where: { AND: [where, { version: expectedVersion }] },
          data: {
            branchId,
            ownerMembershipId,
            updatedByMembershipId: fresh.membershipId,
            version: { increment: 1 },
            ...(input
              ? {
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.phone !== undefined
                    ? {
                        phone: input.phone,
                        normalizedPhone: input.phone ? normalizePhone(input.phone) : null,
                      }
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
                  ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
                }
              : { active: false }),
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          await tx.companyAssignmentHistory.create({
            data: {
              organizationId: fresh.organizationId,
              companyId: id,
              fromBranchId: current.branchId,
              toBranchId: branchId,
              fromOwnerMembershipId: current.ownerMembershipId,
              toOwnerMembershipId: ownerMembershipId,
              actorMembershipId: fresh.membershipId,
              recordVersion: current.version + 1,
            },
          });
        }
        const row = await tx.company.findFirstOrThrow({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        return this.response(tx, fresh, row);
      }),
    );
  }
  async branches(context: TenantContext, query: AssignmentQuery) {
    const scope = assignmentScope(context, `companies.${query.action}`);
    return this.directory.branches(
      this.database.client,
      context.organizationId,
      scope.branchIds,
      query,
    );
  }
  async owners(context: TenantContext, query: AssignmentQuery) {
    if (!query.branchId) throw new ApplicationError('INVALID_INPUT', 'Branch selection required.');
    const scope = assignmentScope(context, `companies.${query.action}`);
    if (scope.branchIds && !scope.branchIds.includes(query.branchId))
      throw new ApplicationError('FORBIDDEN', 'Branch outside action scope.');
    const canAssign = permits(context, 'companies.assign', { branchId: query.branchId });
    return this.directory.owners(
      this.database.client,
      context.organizationId,
      query.branchId,
      scope.ownOnly || (query.action !== 'read' && !canAssign) ? context.membershipId : undefined,
      query,
    );
  }
}
