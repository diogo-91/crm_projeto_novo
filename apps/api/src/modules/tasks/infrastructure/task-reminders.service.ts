import type { ReminderStatus } from '@crm/contracts';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { AccessControlService } from '../../access-control/index.js';
import { DatabaseService } from '../../database/database.module.js';
import { NotificationsDeliveryGateway } from '../../notifications/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { taskScope, reminderDelay } from '../domain/task-policy.js';
@Injectable()
export class TaskRemindersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(NotificationsDeliveryGateway)
    private readonly notifications: NotificationsDeliveryGateway,
  ) {}
  async claim() {
    return this.database.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM task_reminders WHERE state IN ('PENDING','DISPATCHED') AND available_at <= now() AND (lease_until IS NULL OR lease_until <= now()) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 25`;
      return Promise.all(
        rows.map(async (row) => {
          const token = randomUUID();
          await tx.taskReminder.update({
            where: { id: row.id },
            data: {
              state: 'DISPATCHED',
              leaseToken: token,
              leaseUntil: new Date(Date.now() + 60000),
            },
          });
          return { id: row.id, token };
        }),
      );
    });
  }
  async dispatched(id: string, token: string) {
    await this.database.client.taskReminder.updateMany({
      where: { id, leaseToken: token, state: 'DISPATCHED' },
      data: { leaseUntil: new Date(Date.now() + 60000) },
    });
  }
  async failure(id: string, token?: string) {
    await this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM task_reminders WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.taskReminder.findUnique({ where: { id } });
      if (
        !row ||
        !['PENDING', 'DISPATCHED'].includes(row.state) ||
        (token && row.leaseToken !== token)
      )
        return;
      const attempts = row.attemptCount + 1;
      await tx.taskReminder.update({
        where: { id },
        data: {
          attemptCount: attempts,
          state: attempts >= 5 ? 'FAILED' : 'PENDING',
          lastErrorCode: 'DELIVERY_UNAVAILABLE',
          availableAt: new Date(Date.now() + reminderDelay(attempts)),
          leaseToken: null,
          leaseUntil: null,
        },
      });
    });
  }
  async process(id: string) {
    const snapshot = await this.database.client.taskReminder.findUnique({
      where: { id },
      select: { organizationId: true, recipientMembershipId: true, taskId: true },
    });
    if (!snapshot) return;
    await this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organization_memberships WHERE organization_id = ${snapshot.organizationId}::uuid AND id = ${snapshot.recipientMembershipId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM tasks WHERE organization_id = ${snapshot.organizationId}::uuid AND id = ${snapshot.taskId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM task_reminders WHERE organization_id = ${snapshot.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
      const row = await tx.taskReminder.findUnique({ where: { id }, include: { task: true } });
      if (!row || !['PENDING', 'DISPATCHED'].includes(row.state)) return;
      if (row.availableAt.getTime() > Date.now()) return;
      const context = await this.access.deliveryContext(
        tx,
        row.organizationId,
        row.recipientMembershipId,
      );
      const visible =
        context &&
        context.grants.some((g) => g.permissions.includes('notifications.read')) &&
        context.grants.some((g) => g.permissions.includes('tasks.read'))
          ? await tx.task.findFirst({
              where: { AND: [taskScope(context, 'tasks.read', false), { id: row.taskId }] },
              select: { id: true },
            })
          : null;
      const task = row.task;
      if (
        !visible ||
        !task.active ||
        task.status !== 'OPEN' ||
        task.reminderVersion !== row.scheduledVersion ||
        task.ownerMembershipId !== row.recipientMembershipId ||
        !task.remindAt
      ) {
        await tx.taskReminder.update({
          where: { id },
          data: { state: 'CANCELED', leaseToken: null, leaseUntil: null },
        });
        return;
      }
      if (task.remindAt.getTime() > Date.now()) return;
      await this.notifications.deliver(tx, row);
      await tx.taskReminder.update({
        where: { id },
        data: {
          state: 'COMPLETED',
          completedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
          lastErrorCode: null,
        },
      });
    });
  }
  private async requireTask(tx: DatabaseTransaction, context: TenantContext, id: string) {
    const row = await tx.task.findFirst({
      where: { AND: [taskScope(context), { id }] },
      select: { id: true, version: true },
    });
    if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Task unavailable.');
    return row;
  }
  async status(context: TenantContext, id: string): Promise<ReminderStatus> {
    await this.requireTask(this.database.client, context, id);
    return this.database.client.taskReminder
      .findFirst({
        where: { organizationId: context.organizationId, taskId: id },
        orderBy: { scheduledVersion: 'desc' },
        select: {
          id: true,
          state: true,
          attemptCount: true,
          lastErrorCode: true,
          availableAt: true,
        },
      })
      .then((row) => (row ? { ...row, availableAt: row.availableAt.toISOString() } : null));
  }
  async retry(context: TenantContext, id: string, version: number) {
    return this.database.client.$transaction(async (tx) => {
      const fresh = await this.access.lockAndAuthorize(tx, context, 'tasks.update', 'collection');
      await tx.$queryRaw`SELECT id FROM tasks WHERE organization_id = ${fresh.organizationId}::uuid AND id = ${id}::uuid FOR UPDATE`;
      const task = await this.requireTask(tx, fresh, id);
      if (task.version !== version)
        throw new ApplicationError('RESOURCE_CONFLICT', 'Task changed.');
      const current = await tx.task.findFirst({
        where: { AND: [taskScope(fresh, 'tasks.update'), { id, active: true, status: 'OPEN' }] },
        select: { reminderVersion: true, remindAt: true },
      });
      if (!current) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Task unavailable.');
      const changed = await tx.taskReminder.updateMany({
        where: {
          organizationId: fresh.organizationId,
          taskId: id,
          scheduledVersion: current.reminderVersion,
          state: 'FAILED',
        },
        data: {
          state: 'PENDING',
          attemptCount: 0,
          lastErrorCode: null,
          availableAt: new Date(Math.max(Date.now(), current.remindAt?.getTime() ?? 0)),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (changed.count !== 1)
        throw new ApplicationError('RESOURCE_CONFLICT', 'No failed reminder to retry.');
      return { accepted: true as const };
    });
  }
  async metrics() {
    const now = new Date();
    const [pending, failed, oldest] = await Promise.all([
      this.database.client.taskReminder.count({
        where: { state: { in: ['PENDING', 'DISPATCHED'] } },
      }),
      this.database.client.taskReminder.count({ where: { state: 'FAILED' } }),
      this.database.client.taskReminder.findFirst({
        where: { state: { in: ['PENDING', 'DISPATCHED'] }, availableAt: { lte: now } },
        orderBy: { availableAt: 'asc' },
        select: { availableAt: true },
      }),
    ]);
    return { pending, failed, lagMs: oldest ? now.getTime() - oldest.availableAt.getTime() : 0 };
  }
}
