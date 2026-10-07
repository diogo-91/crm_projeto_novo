import type { TimelineEntry } from '@crm/contracts';
import type { TimelineQuery } from '@crm/contracts';
import { currencySchema } from '@crm/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateOpportunity,
  UpdateOpportunity,
  OpportunityListQuery,
  OpportunityResponse,
  MoveOpportunity,
  AssignmentQuery,
  PermissionCode,
  ListQuery,
  StageHistoryListResponse,
} from '@crm/contracts';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import {
  AccessControlService,
  commercialScope,
  assignmentScope,
  permits,
  collectionScope,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ContactsLookupGateway } from '../../contacts/index.js';
import { CompaniesLookupGateway } from '../../companies/index.js';
import { PipelinesLookupGateway } from '../../pipelines/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import {
  commercialPage,
  cursorFilter,
  identityPage,
} from '../../../common/commercial-pagination.js';
import { stageTransition } from '../domain/stage-transition.js';
const columns = {
  id: true,
  name: true,
  branchId: true,
  ownerMembershipId: true,
  contactId: true,
  companyId: true,
  pipelineId: true,
  stageId: true,
  status: true,
  amount: true,
  currency: true,
  closedAt: true,
  lostReason: true,
  notes: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;
type Row = Prisma.OpportunityGetPayload<{ select: typeof columns }>;
@Injectable()
export class OpportunitiesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
    @Inject(ContactsLookupGateway) private readonly contacts: ContactsLookupGateway,
    @Inject(CompaniesLookupGateway) private readonly companies: CompaniesLookupGateway,
    @Inject(PipelinesLookupGateway) private readonly pipelines: PipelinesLookupGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<OpportunityResponse[]> {
    const [labels, contacts, companies, stages] = await Promise.all([
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
      this.pipelines.labels(
        tx,
        context.organizationId,
        rows.map((row) => row.stageId),
      ),
    ]);
    return rows.map((row) => {
      const branch = labels.branches.get(row.branchId),
        owner = labels.owners.get(row.ownerMembershipId),
        stage = stages.get(row.stageId);
      if (!branch || !owner || !stage) throw new Error('Opportunity projection missing');
      return {
        id: row.id,
        name: row.name,
        branch,
        owner,
        notes: row.notes,
        contact: row.contactId ? (contacts.get(row.contactId) ?? null) : null,
        company: row.companyId ? (companies.get(row.companyId) ?? null) : null,
        pipeline: stage.pipeline,
        stage: stage.stage,
        status: row.status,
        amount: row.amount.toFixed(4),
        currency: currencySchema.parse(row.currency),
        closedAt: row.closedAt?.toISOString() ?? null,
        lostReason: row.lostReason,
        active: row.active,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  private async response(tx: DatabaseTransaction, context: TenantContext, row: Row) {
    const result = (await this.responses(tx, context, [row]))[0];
    if (!result) throw new Error('Opportunity projection missing');
    return result;
  }
  get(context: TenantContext, id: string) {
    return this.getInTransaction(this.database.client, context, id);
  }
  async getInTransaction(tx: DatabaseTransaction, context: TenantContext, id: string) {
    const row = await tx.opportunity.findFirst({
      where: { AND: [commercialScope(context, 'opportunities.read'), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Opportunity unavailable.');
    return this.response(tx, context, row);
  }
  async target(tx: DatabaseTransaction, context: TenantContext, id: string) {
    const row = await tx.opportunity.findFirst({
      where: { AND: [commercialScope(context, 'opportunities.read'), { id }] },
      select: { id: true, name: true, branchId: true, ownerMembershipId: true, active: true },
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Target unavailable.');
    return row;
  }
  async list(context: TenantContext, query: OpportunityListQuery) {
    const tx = this.database.client;
    if (query.contactId) await this.contacts.requireLink(tx, context, query.contactId, false);
    if (query.companyId) await this.companies.requireLink(tx, context, query.companyId, false);
    const rows = await tx.opportunity.findMany({
      where: {
        AND: [
          commercialScope(context, 'opportunities.read'),
          cursorFilter(query),
          {
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
            ...(query.stageId ? { stageId: query.stageId } : {}),
            ...(query.contactId ? { contactId: query.contactId } : {}),
            ...(query.companyId ? { companyId: query.companyId } : {}),
            ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
          },
        ],
      },
      select: columns,
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(await this.responses(tx, context, rows), query);
  }
  create(context: TenantContext, input: CreateOpportunity) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'opportunities.create',
          'collection',
        );
        return this.createInTransaction(tx, fresh, input);
      }),
    );
  }
  async createInTransaction(
    tx: DatabaseTransaction,
    context: TenantContext,
    input: CreateOpportunity,
    leadId?: string,
  ) {
    collectionScope(context, 'opportunities.create');
    const ownerMembershipId = input.ownerMembershipId ?? context.membershipId;
    this.destination(context, 'opportunities.create', input.branchId, ownerMembershipId);
    if (ownerMembershipId !== context.membershipId)
      this.destination(context, 'opportunities.assign', input.branchId, ownerMembershipId);
    await this.directory.assignment(tx, context.organizationId, input.branchId, ownerMembershipId);
    if (input.contactId) await this.contacts.requireLink(tx, context, input.contactId);
    if (input.companyId) await this.companies.requireLink(tx, context, input.companyId);
    const stage = await this.pipelines.destination(
      tx,
      context,
      input.pipelineId,
      input.stageId,
      input.branchId,
    );
    if (stage.kind !== 'OPEN')
      throw new ApplicationError('INVALID_INPUT', 'Create opportunities in an open stage.');
    const row = await tx.opportunity.create({
      data: {
        organizationId: context.organizationId,
        name: input.name,
        branchId: input.branchId,
        ownerMembershipId,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        notes: input.notes ?? null,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        status: 'OPEN',
        amount: input.amount,
        currency: input.currency,
        leadId: leadId ?? null,
        createdByMembershipId: context.membershipId,
        updatedByMembershipId: context.membershipId,
      },
      select: columns,
    });
    await tx.opportunityStageHistory.create({
      data: {
        organizationId: context.organizationId,
        opportunityId: row.id,
        toPipelineId: row.pipelineId,
        toStageId: row.stageId,
        toStageName: stage.name,
        toStatus: stage.kind,
        actorMembershipId: context.membershipId,
        recordVersion: 1,
      },
    });
    return this.response(tx, context, row);
  }
  update(context: TenantContext, id: string, input: UpdateOpportunity) {
    return this.change(context, id, input.expectedVersion, 'opportunities.update', input);
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.change(context, id, version, 'opportunities.delete');
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
    permission: 'opportunities.update' | 'opportunities.delete',
    input?: UpdateOpportunity,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, permission, 'collection');
        const where = { AND: [commercialScope(fresh, permission), { id }] };
        const current = await tx.opportunity.findFirst({ where, select: columns });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Opportunity unavailable.');
        if (current.version !== version || (input && !current.active))
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        const branchId = input?.branchId ?? current.branchId,
          ownerMembershipId = input?.ownerMembershipId ?? current.ownerMembershipId;
        this.destination(fresh, permission, branchId, ownerMembershipId);
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId) {
          this.destination(
            fresh,
            'opportunities.assign',
            current.branchId,
            current.ownerMembershipId,
          );
          this.destination(fresh, 'opportunities.assign', branchId, ownerMembershipId);
          await this.directory.assignment(tx, fresh.organizationId, branchId, ownerMembershipId);
          await this.pipelines.destination(
            tx,
            fresh,
            current.pipelineId,
            current.stageId,
            branchId,
          );
        }
        if (input?.contactId) await this.contacts.requireLink(tx, fresh, input.contactId);
        if (input?.companyId) await this.companies.requireLink(tx, fresh, input.companyId);
        const changed = await tx.opportunity.updateMany({
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
                  ...(input.amount !== undefined ? { amount: input.amount } : {}),
                  ...(input.currency !== undefined ? { currency: input.currency } : {}),
                  ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
                  ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
                }
              : { active: false }),
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        if (branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId)
          await tx.opportunityAssignmentHistory.create({
            data: {
              organizationId: fresh.organizationId,
              opportunityId: id,
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
          await tx.opportunity.findFirstOrThrow({
            where: { organizationId: fresh.organizationId, id },
            select: columns,
          }),
        );
      }),
    );
  }
  move(context: TenantContext, id: string, input: MoveOpportunity) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(
          tx,
          context,
          'opportunities.move',
          'collection',
        );
        const where = { AND: [commercialScope(fresh, 'opportunities.move'), { id, active: true }] };
        const current = await tx.opportunity.findFirst({ where, select: columns });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Opportunity unavailable.');
        if (current.version !== input.expectedVersion || current.stageId === input.stageId)
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Opportunity changed or already in stage.',
          );
        const stage = await this.pipelines.destination(
          tx,
          fresh,
          current.pipelineId,
          input.stageId,
          current.branchId,
        );
        const previous = (
          await this.pipelines.labels(tx, fresh.organizationId, [current.stageId])
        ).get(current.stageId);
        if (!previous) throw new Error('Previous stage missing');
        const transition = stageTransition(stage.kind, input.reason);
        const changed = await tx.opportunity.updateMany({
          where: { AND: [where, { version: input.expectedVersion }] },
          data: {
            ...transition,
            stageId: stage.id,
            version: { increment: 1 },
            updatedByMembershipId: fresh.membershipId,
          },
        });
        if (changed.count !== 1)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Record changed. Reload before saving.');
        await tx.opportunityStageHistory.create({
          data: {
            organizationId: fresh.organizationId,
            opportunityId: id,
            fromPipelineId: current.pipelineId,
            fromStageId: current.stageId,
            fromStageName: previous.stage.name,
            fromStatus: current.status,
            toPipelineId: current.pipelineId,
            toStageId: stage.id,
            toStageName: stage.name,
            toStatus: stage.kind,
            reason: transition.lostReason,
            recordVersion: current.version + 1,
            actorMembershipId: fresh.membershipId,
          },
        });
        return this.response(
          tx,
          fresh,
          await tx.opportunity.findFirstOrThrow({
            where: { organizationId: fresh.organizationId, id },
            select: columns,
          }),
        );
      }),
    );
  }
  async history(
    context: TenantContext,
    id: string,
    query: ListQuery,
  ): Promise<StageHistoryListResponse> {
    await this.get(context, id);
    const cursor = query.cursor
      ? await this.database.client.opportunityStageHistory.findFirst({
          where: { organizationId: context.organizationId, opportunityId: id, id: query.cursor },
          select: { recordVersion: true },
        })
      : null;
    if (query.cursor && !cursor)
      throw new ApplicationError('INVALID_INPUT', 'Invalid history cursor.');
    const rows = await this.database.client.opportunityStageHistory.findMany({
      where: {
        organizationId: context.organizationId,
        opportunityId: id,
        ...(cursor ? { recordVersion: { gt: cursor.recordVersion } } : {}),
      },
      orderBy: { recordVersion: 'asc' },
      take: query.limit + 1,
    });
    return identityPage(
      rows.map((row) => ({
        id: row.id,
        from:
          row.fromPipelineId && row.fromStageId && row.fromStageName && row.fromStatus
            ? {
                pipelineId: row.fromPipelineId,
                stageId: row.fromStageId,
                name: row.fromStageName,
                status: row.fromStatus,
              }
            : null,
        to: {
          pipelineId: row.toPipelineId,
          stageId: row.toStageId,
          name: row.toStageName,
          status: row.toStatus,
        },
        reason: row.reason,
        recordVersion: row.recordVersion,
        occurredAt: row.occurredAt.toISOString(),
      })),
      query.limit,
    );
  }
  async timeline(
    tx: DatabaseTransaction,
    context: TenantContext,
    id: string,
    query: TimelineQuery,
  ): Promise<TimelineEntry[]> {
    const rows = await tx.opportunityStageHistory.findMany({
      where: {
        AND: [
          {
            organizationId: context.organizationId,
            opportunityId: id,
            opportunity: { is: commercialScope(context, 'opportunities.read') },
          },
          cursorFilter({ ...query, sort: 'createdAt', direction: 'desc' }, 'occurredAt'),
        ],
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return rows.map((row) => ({
      id: row.id,
      type: 'STAGE',
      name: row.toStageName,
      description: row.fromStageName
        ? `${row.fromStageName} → ${row.toStageName}`
        : row.toStageName,
      taskId: null,
      createdAt: row.occurredAt.toISOString(),
      updatedAt: row.occurredAt.toISOString(),
    }));
  }
  async labelsByLead(tx: DatabaseTransaction, context: TenantContext, leadIds: string[]) {
    if (!context.grants.some((grant) => grant.permissions.includes('opportunities.read')))
      return new Map<string, { id: string; name: string }>();
    const rows = await tx.opportunity.findMany({
      where: { AND: [commercialScope(context, 'opportunities.read'), { leadId: { in: leadIds } }] },
      select: { id: true, name: true, leadId: true },
    });
    return new Map(
      rows.flatMap((row) =>
        row.leadId ? [[row.leadId, { id: row.id, name: row.name }] as const] : [],
      ),
    );
  }
  async branches(context: TenantContext, query: AssignmentQuery) {
    const scope = assignmentScope(context, `opportunities.${query.action}`);
    return this.directory.branches(
      this.database.client,
      context.organizationId,
      scope.branchIds,
      query,
    );
  }
  async owners(context: TenantContext, query: AssignmentQuery) {
    if (!query.branchId) throw new ApplicationError('INVALID_INPUT', 'Branch selection required.');
    const scope = assignmentScope(context, `opportunities.${query.action}`);
    if (scope.branchIds && !scope.branchIds.includes(query.branchId))
      throw new ApplicationError('FORBIDDEN', 'Branch outside action scope.');
    const canAssign = permits(context, 'opportunities.assign', { branchId: query.branchId });
    return this.directory.owners(
      this.database.client,
      context.organizationId,
      query.branchId,
      scope.ownOnly || (query.action !== 'read' && !canAssign) ? context.membershipId : undefined,
      query,
    );
  }
}
