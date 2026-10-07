import type { TimelineResponse } from '@crm/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import type {
  AssignmentQuery,
  CreateTask,
  UpdateTask,
  TaskListQuery,
  TaskResponse,
  TimelineQuery,
  TimelineEntry,
  ResourceTarget,
  PermissionCode,
} from '@crm/contracts';
import { validReminderDates } from '@crm/contracts';
import { DatabaseService } from '../../database/database.module.js';
import { AccessControlService, permits, assignmentScope } from '../../access-control/index.js';
import type { TenantContext, ResourceContext } from '../../access-control/index.js';
import { CommercialDirectoryGateway } from '../../organizations/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { targetFields, targetOf, taskScope } from '../domain/task-policy.js';
import { TaskTargetGateway } from './task-target.gateway.js';
type Row = Prisma.TaskGetPayload<Record<string, never>>;
@Injectable()
export class TasksRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(CommercialDirectoryGateway) private readonly directory: CommercialDirectoryGateway,
    @Inject(TaskTargetGateway) private readonly targets: TaskTargetGateway,
  ) {}
  private async responses(
    tx: DatabaseTransaction,
    context: ResourceContext,
    rows: Row[],
  ): Promise<TaskResponse[]> {
    const labels = await this.directory.labels(tx, context.organizationId, rows);
    return rows.map((row) => {
      const branch = labels.branches.get(row.branchId),
        owner = labels.owners.get(row.ownerMembershipId);
      if (!branch || !owner) throw new Error('Task projection missing');
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        branch,
        owner,
        kind: row.kind,
        priority: row.priority,
        status: row.status,
        dueAt: row.dueAt?.toISOString() ?? null,
        remindAt: row.remindAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        target: targetOf(row),
        active: row.active,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
  private async response(tx: DatabaseTransaction, context: ResourceContext, row: Row) {
    const result = (await this.responses(tx, context, [row]))[0];
    if (!result) throw new Error('Task projection missing');
    return result;
  }
  async get(context: TenantContext, id: string) {
    return this.response(
      this.database.client,
      context,
      await this.require(this.database.client, context, id),
    );
  }
  private async require(
    tx: DatabaseTransaction,
    context: ResourceContext,
    id: string,
  ): Promise<Row> {
    const row = await tx.task.findFirst({ where: { AND: [taskScope(context), { id }] } });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Task unavailable.');
    return row;
  }
  async list(context: TenantContext, query: TaskListQuery) {
    if (query.targetType && query.targetId)
      await this.targets.require(this.database.client, context, {
        type: query.targetType,
        id: query.targetId,
      });
    const now = new Date(),
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      end = new Date(start.getTime() + 86400000);
    const due =
      query.due === 'overdue'
        ? { status: 'OPEN' as const, dueAt: { lt: now } }
        : query.due === 'today'
          ? { dueAt: { gte: start, lt: end } }
          : query.due === 'upcoming'
            ? { status: 'OPEN' as const, dueAt: { gte: now } }
            : {};
    const rows = await this.database.client.task.findMany({
      where: {
        AND: [
          taskScope(context),
          cursorFilter(query),
          due,
          {
            ...(query.search
              ? {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' as const } },
                    { description: { contains: query.search, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
            ...(query.active ? { active: query.active === 'true' } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.kind ? { kind: query.kind } : {}),
            ...(query.priority ? { priority: query.priority } : {}),
            ...(query.branchId ? { branchId: query.branchId } : {}),
            ...(query.ownerMembershipId ? { ownerMembershipId: query.ownerMembershipId } : {}),
            ...(query.targetType && query.targetId
              ? targetFields({ type: query.targetType, id: query.targetId })
              : {}),
            ...(query.from || query.until
              ? {
                  dueAt: {
                    ...(query.from ? { gte: new Date(query.from) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {}),
                  },
                }
              : {}),
          },
        ],
      },
      orderBy: [{ [query.sort]: query.direction }, { id: query.direction }],
      take: query.limit + 1,
    });
    return commercialPage(await this.responses(this.database.client, context, rows), query);
  }
  private destination(
    context: ResourceContext,
    permission: PermissionCode,
    branchId: string,
    ownerMembershipId: string,
  ) {
    if (!permits(context, permission, { branchId, ownerMembershipId }))
      throw new ApplicationError('FORBIDDEN', 'Assignment outside action scope.');
  }
  private async schedule(tx: DatabaseTransaction, row: Row) {
    await tx.taskReminder.updateMany({
      where: {
        organizationId: row.organizationId,
        taskId: row.id,
        state: { in: ['PENDING', 'DISPATCHED', 'FAILED'] },
      },
      data: { state: 'CANCELED', leaseToken: null, leaseUntil: null },
    });
    if (row.active && row.status === 'OPEN' && row.remindAt)
      await tx.taskReminder.create({
        data: {
          organizationId: row.organizationId,
          taskId: row.id,
          recipientMembershipId: row.ownerMembershipId,
          scheduledVersion: row.reminderVersion,
          availableAt: row.remindAt,
        },
      });
  }
  create(context: TenantContext, input: CreateTask) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const fresh = await this.access.lockAndAuthorize(tx, context, 'tasks.create', 'collection');
        const owner = input.ownerMembershipId ?? fresh.membershipId;
        this.destination(fresh, 'tasks.create', input.branchId, owner);
        this.destination(fresh, 'tasks.read', input.branchId, owner);
        if (owner !== fresh.membershipId)
          this.destination(fresh, 'tasks.assign', input.branchId, owner);
        await this.directory.assignment(tx, fresh.organizationId, input.branchId, owner);
        if (input.target) {
          const target = await this.targets.require(tx, fresh, input.target);
          if (!target.active) throw new ApplicationError('RESOURCE_CONFLICT', 'Target archived.');
        }
        const row = await tx.task.create({
          data: {
            organizationId: fresh.organizationId,
            name: input.name,
            description: input.description ?? null,
            branchId: input.branchId,
            ownerMembershipId: owner,
            kind: input.kind,
            priority: input.priority,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            remindAt: input.remindAt ? new Date(input.remindAt) : null,
            ...targetFields(input.target),
            createdByMembershipId: fresh.membershipId,
            updatedByMembershipId: fresh.membershipId,
          },
        });
        await this.event(tx, row, fresh.membershipId, 'CREATED');
        await this.schedule(tx, row);
        return this.response(tx, fresh, row);
      }),
    );
  }
  private event(
    tx: DatabaseTransaction,
    row: Row,
    actor: string,
    kind: 'CREATED' | 'UPDATED' | 'COMPLETED' | 'REOPENED' | 'ARCHIVED',
  ) {
    return tx.taskHistory.create({
      data: {
        organizationId: row.organizationId,
        taskId: row.id,
        actorMembershipId: actor,
        kind,
        name: row.name,
        recordVersion: row.version,
      },
    });
  }
  change(
    context: TenantContext,
    id: string,
    expectedVersion: number,
    input?: UpdateTask,
    command?: 'complete' | 'reopen' | 'archive',
  ) {
    return persist(() =>
      this.database.client.$transaction(async (tx) => {
        const permission =
          command === 'archive' ? 'tasks.delete' : command ? 'tasks.complete' : 'tasks.update';
        const fresh = await this.access.lockAndAuthorize(tx, context, permission, 'collection');
        await tx.$queryRaw`SELECT id FROM tasks WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
        const current = await tx.task.findFirst({
          where: { AND: [taskScope(fresh, permission), taskScope(fresh), { id }] },
        });
        if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Task unavailable.');
        if (current.version !== expectedVersion || !current.active)
          throw new ApplicationError('RESOURCE_CONFLICT', 'Task changed or archived.');
        if (
          (command === 'complete' && current.status !== 'OPEN') ||
          (command === 'reopen' && current.status !== 'COMPLETED')
        )
          throw new ApplicationError('RESOURCE_CONFLICT', 'Task already in requested state.');
        const branchId = input?.branchId ?? current.branchId,
          ownerMembershipId = input?.ownerMembershipId ?? current.ownerMembershipId;
        this.destination(fresh, permission, branchId, ownerMembershipId);
        this.destination(fresh, 'tasks.read', branchId, ownerMembershipId);
        const reassigned =
          branchId !== current.branchId || ownerMembershipId !== current.ownerMembershipId;
        if (reassigned) {
          this.destination(fresh, 'tasks.assign', current.branchId, current.ownerMembershipId);
          this.destination(fresh, 'tasks.assign', branchId, ownerMembershipId);
          await this.directory.assignment(tx, fresh.organizationId, branchId, ownerMembershipId);
        }
        const target = input?.target === undefined ? targetOf(current) : input.target;
        if (input?.target) {
          const selected = await this.targets.require(tx, fresh, input.target);
          if (!selected.active) throw new ApplicationError('RESOURCE_CONFLICT', 'Target archived.');
        }
        const dueAt =
            input?.dueAt === undefined ? current.dueAt : input.dueAt ? new Date(input.dueAt) : null,
          remindAt =
            input?.remindAt === undefined
              ? current.remindAt
              : input.remindAt
                ? new Date(input.remindAt)
                : null;
        if (!validReminderDates({ dueAt: dueAt?.toISOString(), remindAt: remindAt?.toISOString() }))
          throw new ApplicationError(
            'INVALID_INPUT',
            'Reminder requires a due date and cannot follow it.',
          );
        const reschedule =
          reassigned ||
          Boolean(command) ||
          current.dueAt?.getTime() !== dueAt?.getTime() ||
          current.remindAt?.getTime() !== remindAt?.getTime() ||
          JSON.stringify(targetOf(current)) !== JSON.stringify(target);
        const row = await tx.task.update({
          where: { organizationId_id: { organizationId: fresh.organizationId, id } },
          data: {
            ...(input?.name !== undefined ? { name: input.name } : {}),
            ...(input?.description !== undefined ? { description: input.description } : {}),
            ...(input?.kind !== undefined ? { kind: input.kind } : {}),
            ...(input?.priority !== undefined ? { priority: input.priority } : {}),
            branchId,
            ownerMembershipId,
            dueAt,
            remindAt,
            ...targetFields(target),
            ...(command === 'complete' ? { status: 'COMPLETED', completedAt: new Date() } : {}),
            ...(command === 'reopen' ? { status: 'OPEN', completedAt: null } : {}),
            ...(command === 'archive' ? { active: false } : {}),
            version: { increment: 1 },
            ...(reschedule ? { reminderVersion: { increment: 1 } } : {}),
            updatedByMembershipId: fresh.membershipId,
          },
        });
        await this.event(
          tx,
          row,
          fresh.membershipId,
          command === 'complete'
            ? 'COMPLETED'
            : command === 'reopen'
              ? 'REOPENED'
              : command === 'archive'
                ? 'ARCHIVED'
                : 'UPDATED',
        );
        if (reschedule) await this.schedule(tx, row);
        return this.response(tx, fresh, row);
      }),
    );
  }
  async branches(context: TenantContext, query: AssignmentQuery) {
    const scope = assignmentScope(context, `tasks.${query.action}`);
    return this.directory.branches(
      this.database.client,
      context.organizationId,
      scope.branchIds,
      query,
    );
  }
  async owners(context: TenantContext, query: AssignmentQuery) {
    if (!query.branchId) throw new ApplicationError('INVALID_INPUT', 'Branch required.');
    const scope = assignmentScope(context, `tasks.${query.action}`);
    if (scope.branchIds && !scope.branchIds.includes(query.branchId))
      throw new ApplicationError('FORBIDDEN', 'Branch outside action scope.');
    const assign = permits(context, 'tasks.assign', { branchId: query.branchId });
    return this.directory.owners(
      this.database.client,
      context.organizationId,
      query.branchId,
      scope.ownOnly || (query.action !== 'read' && !assign) ? context.membershipId : undefined,
      query,
    );
  }
  async timeline(
    tx: DatabaseTransaction,
    context: TenantContext,
    target: ResourceTarget,
    query: TimelineQuery,
  ): Promise<TimelineEntry[]> {
    const rows = await tx.taskHistory.findMany({
      where: {
        AND: [
          {
            organizationId: context.organizationId,
            task: { is: { AND: [taskScope(context, 'tasks.read', false), targetFields(target)] } },
          },
          cursorFilter({ ...query, sort: 'createdAt', direction: 'desc' }),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return rows.map((r) => ({
      id: r.id,
      type: 'TASK',
      name: r.kind,
      description: r.name,
      taskId: r.taskId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.createdAt.toISOString(),
    }));
  }
  async history(
    context: TenantContext,
    id: string,
    query: TimelineQuery,
  ): Promise<TimelineResponse> {
    await this.require(this.database.client, context, id);
    const rows = await this.database.client.taskHistory.findMany({
      where: {
        AND: [
          { organizationId: context.organizationId, taskId: id },
          cursorFilter({ ...query, sort: 'createdAt', direction: 'desc' }),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return commercialPage(
      rows.map((r) => ({
        id: r.id,
        type: 'TASK' as const,
        name: r.kind,
        description: r.name,
        taskId: r.taskId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.createdAt.toISOString(),
      })),
      { ...query, sort: 'createdAt', direction: 'desc' },
    );
  }
}
