import { Inject, Injectable } from '@nestjs/common';
import { normalizePhone } from '@crm/contracts';
import type {
  CreateLead,
  UpdateLead,
  LeadListQuery,
  LeadResponse,
  ConvertLead,
  AssignmentQuery,
  PermissionCode,
} from '@crm/contracts';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import {
  AccessControlService,
  commercialScope,
  assignmentScope,
  permits,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ContactsLookupGateway } from '../../contacts/index.js';
import { CompaniesLookupGateway } from '../../companies/index.js';
import { OpportunitiesGateway } from '../../opportunities/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { conversionIntent } from '../domain/conversion-intent.js';
const columns = {
  id: true,
  name: true,
  branchId: true,
  ownerMembershipId: true,
  contactId: true,
  companyId: true,
  phone: true,
  email: true,
  companyName: true,
  source: true,
  status: true,
  convertedAt: true,
  conversionRequestHash: true,
  notes: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
type Row = Prisma.LeadGetPayload<{ select: typeof columns }>;
@Injectable()
export class LeadsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
    @Inject(ContactsLookupGateway) private readonly contacts: ContactsLookupGateway,
    @Inject(CompaniesLookupGateway) private readonly companies: CompaniesLookupGateway,
    @Inject(OpportunitiesGateway) private readonly opportunities: OpportunitiesGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<LeadResponse[]> {
    const [labels, contacts, companies, opportunities] = await Promise.all([
      this.directory.labels(tx, context.organizationId, rows),
      this.contacts.labels(
        tx,
        context,
        rows.flatMap((row) => (row.contactId ? [row.contactId] : [])),
      ),
      this.companies.labels(
        tx,
        context,
        rows.flatMap((row) => (row.companyId ? [row.companyId] : [])),
      ),
      this.opportunities.labelsByLead(
        tx,
        context,
        rows.map((row) => row.id),
      ),
    ]);
    return rows.map((row) => {
      const branch = labels.branches.get(row.branchId),
        owner = labels.owners.get(row.ownerMembershipId);
      if (!branch || !owner) throw new Error('Lead projection missing');
      return {
        id: row.id,
        name: row.name,
        branch,
        owner,
        notes: row.notes,
        contact: row.contactId ? (contacts.get(row.contactId) ?? null) : null,
        company: row.companyId ? (companies.get(row.companyId) ?? null) : null,
        phone: row.phone,
        email: row.email,
        companyName: row.companyName,
        source: row.source,
        status: row.status,
        convertedAt: row.convertedAt?.toISOString() ?? null,
        opportunity: opportunities.get(row.id) ?? null,
        active: row.active,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  private async response(tx: DatabaseTransaction, context: TenantContext, row: Row) {
    const result = (await this.responses(tx, context, [row]))[0];
    if (!result) throw new Error('Lead projection missing');
    return result;
  }
  async get(context: TenantContext, id: string) {
    const row = await this.database.client.lead.findFirst({
      where: { AND: [commercialScope(context, 'leads.read'), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Lead unavailable.');
    return this.response(this.database.client, context, row);
  }
  async list(context: TenantContext, query: LeadListQuery) {
    const rows = await this.database.client.lead.findMany({
      where: {
        AND: [
          commercialScope(context, 'leads.read'),
          cursorFilter(query),
          {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.source ? { source: query.source } : {}),
            ...(query.search
              ? {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { companyName: { contains: query.search, mode: 'insensitive' } },
                    ...(normalizePhone(query.search)
                      ? [{ normalizedPhone: { contains: normalizePhone(query.search) } }]
                      : []),
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
    return commercialPage(await this.responses(this.database.client, context, rows), query);
  }
  create(context: TenantContext, input: CreateLead) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'leads.create', 'collection');
        const ownerMembershipId = input.ownerMembershipId ?? fresh.membershipId;
        this.destination(fresh, 'leads.create', input.branchId, ownerMembershipId);
        if (ownerMembershipId !== fresh.membershipId)
          this.destination(fresh, 'leads.assign', input.branchId, ownerMembershipId);
        await this.directory.assignment(
          tx,
          fresh.organizationId,
          input.branchId,
          ownerMembershipId,
        );
        if (input.contactId) await this.contacts.requireLink(tx, fresh, input.contactId);
        if (input.companyId) await this.companies.requireLink(tx, fresh, input.companyId);
        const row = await tx.lead.create({
          data: {
            organizationId: fresh.organizationId,
            name: input.name,
            branchId: input.branchId,
            ownerMembershipId,
            contactId: input.contactId ?? null,
            companyId: input.companyId ?? null,
            notes: input.notes ?? null,
            phone: input.phone ?? null,
            normalizedPhone: input.phone ? normalizePhone(input.phone) : null,
            email: input.email ?? null,
            companyName: input.companyName ?? null,
            source: input.source,
            createdByMembershipId: fresh.membershipId,
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        return this.response(tx, fresh, row);
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdateLead) {
    return this.change(context, id, input.expectedVersion, 'leads.update', input);
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.change(context, id, version, 'leads.delete');
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
    version: number,
    permission: 'leads.update' | 'leads.delete',
    input?: UpdateLead,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, permission, 'collection');
        const where = { AND: [commercialScope(fresh, permission), { id }] };
        const current = await tx.lead.findFirst({ where, select: columns });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Lead unavailable.');
        if (
          current.version !== version ||
          (input && (current.status === 'CONVERTED' || !current.active))
        )
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Lead changed, inactive or already converted.',
          );
        const branchId = input?.branchId ?? current.branchId,
          ownerMembershipId = input?.ownerMembershipId ?? current.ownerMembershipId;
        this.destination(fresh, permission, branchId, ownerMembershipId);
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          this.destination(fresh, 'leads.assign', current.branchId, current.ownerMembershipId);
          this.destination(fresh, 'leads.assign', branchId, ownerMembershipId);
          await this.directory.assignment(tx, fresh.organizationId, branchId, ownerMembershipId);
        }
        if (input?.contactId) await this.contacts.requireLink(tx, fresh, input.contactId);
        if (input?.companyId) await this.companies.requireLink(tx, fresh, input.companyId);
        const changed = await tx.lead.updateMany({
          where: { AND: [where, { version }] },
          data: {
            branchId,
            ownerMembershipId,
            version: { increment: 1 },
            updatedByMembershipId: fresh.membershipId,
            ...(input
              ? {
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.notes !== undefined ? { notes: input.notes } : {}),
                  ...(input.phone !== undefined
                    ? {
                        phone: input.phone,
                        normalizedPhone: input.phone ? normalizePhone(input.phone) : null,
                      }
                    : {}),
                  ...(input.email !== undefined ? { email: input.email } : {}),
                  ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
                  ...(input.source !== undefined ? { source: input.source } : {}),
                  ...(input.status !== undefined ? { status: input.status } : {}),
                  ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
                  ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
                }
              : { active: false }),
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId)
          await tx.leadAssignmentHistory.create({
            data: {
              organizationId: fresh.organizationId,
              leadId: id,
              fromBranchId: current.branchId,
              toBranchId: branchId,
              fromOwnerMembershipId: current.ownerMembershipId,
              toOwnerMembershipId: ownerMembershipId,
              actorMembershipId: fresh.membershipId,
              recordVersion: version + 1,
            },
          });
        return this.response(
          tx,
          fresh,
          await tx.lead.findFirstOrThrow({
            where: { organizationId: fresh.organizationId, id },
            select: columns,
          }),
        );
      }),
    );
  }
  convert(context: TenantContext, id: string, input: ConvertLead) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'leads.convert',
          'collection',
        );
        await tx.$queryRaw`SELECT id FROM leads WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const row = await tx.lead.findFirst({
          where: {
            AND: [
              commercialScope(fresh, 'leads.convert'),
              commercialScope(fresh, 'leads.read'),
              { id, active: true },
            ],
          },
          select: columns,
        });
        if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Lead unavailable.');
        const intent = conversionIntent(input);
        if (row.status === 'CONVERTED') {
          if (row.conversionRequestHash !== intent)
            throw new ApplicationError(
              'RESOURCE_CONFLICT',
              'Lead already converted with another intent.',
            );
          const link = (await this.opportunities.labelsByLead(tx, fresh, [id])).get(id);
          if (!link)
            throw new ApplicationError('RESOURCE_NOT_FOUND', 'Converted opportunity unavailable.');
          return {
            lead: await this.response(tx, fresh, row),
            opportunity: await this.opportunities.get(tx, fresh, link.id),
          };
        }
        if (row.version !== input.expectedVersion || row.status !== 'QUALIFIED')
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Qualify the current lead before conversion.',
          );
        // Read authority is required too: conversion returns the new opportunity.
        this.destination(fresh, 'opportunities.read', row.branchId, row.ownerMembershipId);
        let companyId = input.companyId === undefined ? row.companyId : input.companyId;
        let contactId = input.contactId === undefined ? row.contactId : input.contactId;
        if (input.createCompany) {
          if (!row.companyName)
            throw new ApplicationError(
              'INVALID_INPUT',
              'Company name required to create a company.',
            );
          companyId = (
            await this.companies.create(tx, fresh, {
              name: row.companyName,
              branchId: row.branchId,
              ownerMembershipId: row.ownerMembershipId,
            })
          ).id;
        }
        if (input.createContact) {
          if (!row.phone)
            throw new ApplicationError('INVALID_INPUT', 'Phone required to create a contact.');
          contactId = (
            await this.contacts.create(tx, fresh, {
              name: row.name,
              phone: row.phone,
              email: row.email,
              notes: row.notes,
              source: row.source,
              companyId,
              tagIds: [],
              branchId: row.branchId,
              ownerMembershipId: row.ownerMembershipId,
            })
          ).id;
        }
        const opportunity = await this.opportunities.create(
          tx,
          fresh,
          {
            name: input.opportunityName ?? row.name,
            branchId: row.branchId,
            ownerMembershipId: row.ownerMembershipId,
            contactId,
            companyId,
            notes: row.notes,
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            amount: input.amount,
            currency: input.currency,
          },
          id,
        );
        const converted = await tx.lead.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: {
            status: 'CONVERTED',
            convertedAt: new Date(),
            conversionRequestHash: intent,
            contactId,
            companyId,
            version: { increment: 1 },
            updatedByMembershipId: fresh.membershipId,
          },
          select: columns,
        });
        return { lead: await this.response(tx, fresh, converted), opportunity };
      }),
    );
  }
  async branches(context: TenantContext, query: AssignmentQuery) {
    const scope = assignmentScope(context, `leads.${query.action}`);
    return this.directory.branches(
      this.database.client,
      context.organizationId,
      scope.branchIds,
      query,
    );
  }
  async owners(context: TenantContext, query: AssignmentQuery) {
    if (!query.branchId) throw new ApplicationError('INVALID_INPUT', 'Branch selection required.');
    const scope = assignmentScope(context, `leads.${query.action}`);
    if (scope.branchIds && !scope.branchIds.includes(query.branchId))
      throw new ApplicationError('FORBIDDEN', 'Branch outside action scope.');
    const canAssign = permits(context, 'leads.assign', { branchId: query.branchId });
    return this.directory.owners(
      this.database.client,
      context.organizationId,
      query.branchId,
      scope.ownOnly || (query.action !== 'read' && !canAssign) ? context.membershipId : undefined,
      query,
    );
  }
}
