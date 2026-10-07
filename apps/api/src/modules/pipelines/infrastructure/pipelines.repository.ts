import { Inject, Injectable } from '@nestjs/common';
import { normalizeTagName } from '@crm/contracts';
import type {
  CreatePipeline,
  UpdatePipeline,
  AddStage,
  UpdateStage,
  ReorderStages,
  PipelineListQuery,
  PipelineResponse,
  StageResponse,
} from '@crm/contracts';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { identityPage } from '../../../common/commercial-pagination.js';
import { pipelineScope } from '../domain/pipeline-policy.js';
const stageColumns = { id: true, name: true, kind: true, position: true, active: true } as const;
const columns = {
  id: true,
  name: true,
  branchId: true,
  active: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  stages: { select: stageColumns, orderBy: [{ position: 'asc' }, { id: 'asc' }] },
} as const satisfies Prisma.PipelineSelect;
type Row = Prisma.PipelineGetPayload<{ select: typeof columns }>;
@Injectable()
export class PipelinesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: TenantContext,
    rows: Row[],
  ): Promise<PipelineResponse[]> {
    const labels = await this.directory.labels(
      tx,
      context.organizationId,
      rows.flatMap((row) =>
        row.branchId ? [{ branchId: row.branchId, ownerMembershipId: context.membershipId }] : [],
      ),
    );
    return rows.map((row) => {
      const branch = row.branchId ? labels.branches.get(row.branchId) : null;
      if (branch === undefined) throw new Error('Pipeline branch projection missing');
      return {
        id: row.id,
        name: row.name,
        branch,
        active: row.active,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        stages: row.stages,
      };
    });
  }
  async list(context: TenantContext, query: PipelineListQuery) {
    const rows = await this.database.client.pipeline.findMany({
      where: {
        AND: [
          pipelineScope(context),
          {
            ...(query.cursor ? { id: { gt: query.cursor } } : {}),
            ...(query.branchId ? { OR: [{ branchId: null }, { branchId: query.branchId }] } : {}),
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.search
              ? { normalizedName: { contains: normalizeTagName(query.search) } }
              : {}),
          },
        ],
      },
      select: columns,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return identityPage(await this.responses(this.database.client, context, rows), query.limit);
  }
  async get(context: TenantContext, id: string) {
    return this.getInTransaction(this.database.client, context, id);
  }
  private async getInTransaction(tx: DatabaseTransaction, context: TenantContext, id: string) {
    const row = await tx.pipeline.findFirst({
      where: { AND: [pipelineScope(context), { id }] },
      select: columns,
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Pipeline unavailable.');
    const response = (await this.responses(tx, context, [row]))[0];
    if (!response) throw new Error('Pipeline projection missing');
    return response;
  }
  create(context: TenantContext, input: CreatePipeline) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'pipelines.manage');
        if (input.branchId)
          await this.directory.requireBranch(tx, fresh.organizationId, input.branchId);
        const row = await tx.pipeline.create({
          data: {
            organizationId: fresh.organizationId,
            name: input.name,
            normalizedName: normalizeTagName(input.name),
            branchId: input.branchId ?? null,
            stages: {
              create: input.stages.map((stage, index) => ({
                name: stage.name,
                normalizedName: normalizeTagName(stage.name),
                kind: stage.kind,
                position: index * 10,
              })),
            },
          },
          select: { id: true },
        });
        return this.getInTransaction(tx, fresh, row.id);
      }),
    );
  }
  update(context: TenantContext, id: string, input: UpdatePipeline) {
    return this.mutate(context, id, input.expectedVersion, async (tx) => {
      await tx.pipeline.update({
        where: { organizationId_id: { organizationId: context.organizationId, id } },
        data: {
          ...(input.name !== undefined
            ? { name: input.name, normalizedName: normalizeTagName(input.name) }
            : {}),
        },
      });
    });
  }
  archive(context: TenantContext, id: string, version: number) {
    return this.mutate(context, id, version, async (tx) => {
      await tx.pipeline.update({
        where: { organizationId_id: { organizationId: context.organizationId, id } },
        data: { active: false },
      });
    });
  }
  addStage(context: TenantContext, id: string, input: AddStage) {
    return this.mutate(context, id, input.expectedVersion, async (tx, row) => {
      if (!row.active) throw new ApplicationError('RESOURCE_CONFLICT', 'Pipeline archived.');
      if (row.stages.length >= 30)
        throw new ApplicationError('RESOURCE_CONFLICT', 'Pipeline stage limit reached.');
      await tx.pipelineStage.create({
        data: {
          organizationId: context.organizationId,
          pipelineId: id,
          name: input.name,
          normalizedName: normalizeTagName(input.name),
          kind: input.kind,
          position: row.stages.length * 10,
        },
      });
    });
  }
  updateStage(context: TenantContext, id: string, stageId: string, input: UpdateStage) {
    return this.mutate(context, id, input.expectedVersion, async (tx, row) => {
      const stage = row.stages.find((stage) => stage.id === stageId);
      if (!stage) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Stage unavailable.');
      if (
        input.active === false &&
        stage.kind === 'OPEN' &&
        stage.active &&
        !row.stages.some((item) => item.id !== stageId && item.kind === 'OPEN' && item.active)
      )
        throw new ApplicationError('RESOURCE_CONFLICT', 'Keep at least one active open stage.');
      await tx.pipelineStage.update({
        where: {
          organizationId_pipelineId_id: {
            organizationId: context.organizationId,
            pipelineId: id,
            id: stageId,
          },
        },
        data: {
          ...(input.name !== undefined
            ? { name: input.name, normalizedName: normalizeTagName(input.name) }
            : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
    });
  }
  reorder(context: TenantContext, id: string, input: ReorderStages) {
    return this.mutate(context, id, input.expectedVersion, async (tx, row) => {
      if (
        input.stageIds.length !== row.stages.length ||
        !row.stages.every((stage) => input.stageIds.includes(stage.id))
      )
        throw new ApplicationError('INVALID_INPUT', 'Include every pipeline stage exactly once.');
      for (const [index, stageId] of input.stageIds.entries())
        await tx.pipelineStage.update({
          where: {
            organizationId_pipelineId_id: {
              organizationId: context.organizationId,
              pipelineId: id,
              id: stageId,
            },
          },
          data: { position: index * 10 },
        });
    });
  }
  private mutate(
    context: TenantContext,
    id: string,
    version: number,
    operation: (tx: DatabaseTransaction, row: Row) => Promise<void>,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'pipelines.manage');
        await tx.$queryRaw`SELECT id FROM pipelines WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const row = await tx.pipeline.findFirst({
          where: { organizationId: fresh.organizationId, id },
          select: columns,
        });
        if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Pipeline unavailable.');
        if (row.version !== version)
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'Pipeline changed. Reload before saving.',
          );
        await operation(tx, row);
        await tx.pipeline.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: { version: { increment: 1 } },
        });
        return this.getInTransaction(tx, fresh, id);
      }),
    );
  }
  async destination(
    tx: DatabaseTransaction,
    context: TenantContext,
    pipelineId: string,
    stageId: string,
    branchId: string,
  ): Promise<StageResponse> {
    await tx.$queryRaw`SELECT id FROM pipelines WHERE organization_id = ${context.organizationId}::uuid AND id = ${pipelineId}::uuid FOR SHARE`;
    const pipeline = await tx.pipeline.findFirst({
      where: {
        AND: [
          pipelineScope(context),
          { id: pipelineId, active: true, OR: [{ branchId: null }, { branchId }] },
        ],
      },
      select: { id: true },
    });
    if (!pipeline)
      throw new ApplicationError('RESOURCE_NOT_FOUND', 'Pipeline unavailable for branch.');
    const stage = await tx.pipelineStage.findFirst({
      where: { organizationId: context.organizationId, pipelineId, id: stageId, active: true },
      select: stageColumns,
    });
    if (!stage) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Stage unavailable.');
    return stage;
  }
  async labels(
    tx: DatabaseTransaction,
    organizationId: string,
    stageIds: string[],
  ): Promise<Map<string, { stage: StageResponse; pipeline: { id: string; name: string } }>> {
    const rows = await tx.pipelineStage.findMany({
      where: { organizationId, id: { in: stageIds } },
      select: { ...stageColumns, pipeline: { select: { id: true, name: true } } },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        {
          stage: {
            id: row.id,
            name: row.name,
            kind: row.kind,
            position: row.position,
            active: row.active,
          },
          pipeline: row.pipeline,
        },
      ]),
    );
  }
}
