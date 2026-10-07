import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { NotificationQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { AccessControlService } from '../../access-control/index.js';
import { taskScope } from '../../tasks/index.js';
import { DatabaseService } from '../../database/database.module.js';
import { commercialPage, cursorFilter } from '../../../common/commercial-pagination.js';
import { ApplicationError } from '../../../common/application-error.js';
@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  private where(context: TenantContext) {
    return {
      organizationId: context.organizationId,
      recipientMembershipId: context.membershipId,
      reminder: { is: { task: { is: taskScope(context, 'tasks.read', false) } } },
    };
  }
  async list(context: TenantContext, query: NotificationQuery) {
    const rows = await this.database.client.notification.findMany({
      where: {
        AND: [
          this.where(context),
          cursorFilter({ ...query, sort: 'createdAt', direction: 'desc' }),
          query.unread === 'true'
            ? { readAt: null }
            : query.unread === 'false'
              ? { readAt: { not: null } }
              : {},
        ],
      },
      select: {
        id: true,
        readAt: true,
        createdAt: true,
        reminder: { select: { task: { select: { id: true, name: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = commercialPage(
      rows.map((r) => ({
        id: r.id,
        task: r.reminder.task,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        name: '',
        updatedAt: r.createdAt.toISOString(),
      })),
      { ...query, sort: 'createdAt', direction: 'desc' },
    );
    return {
      ...page,
      data: page.data.map((row) => ({
        id: row.id,
        task: row.task,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
    };
  }
  async read(context: TenantContext, id: string) {
    return this.database.client.$transaction(async (tx) => {
      const fresh = await this.access.lockAndAuthorize(
        tx,
        context,
        'notifications.update',
        'collection',
      );
      const row = await tx.notification.findFirst({
        where: { AND: [this.where(fresh), { id }] },
        include: { reminder: { include: { task: { select: { id: true, name: true } } } } },
      });
      if (!row) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Notification unavailable.');
      const changed = await tx.notification.update({
        where: { id: row.id },
        data: { readAt: row.readAt ?? new Date() },
      });
      return {
        id: changed.id,
        task: row.reminder.task,
        readAt: changed.readAt?.toISOString() ?? null,
        createdAt: changed.createdAt.toISOString(),
      };
    });
  }
  async deliver(
    tx: DatabaseTransaction,
    source: { id: string; organizationId: string; recipientMembershipId: string },
  ): Promise<void> {
    await tx.notification.upsert({
      where: {
        organizationId_reminderId_recipientMembershipId: {
          organizationId: source.organizationId,
          reminderId: source.id,
          recipientMembershipId: source.recipientMembershipId,
        },
      },
      create: {
        organizationId: source.organizationId,
        reminderId: source.id,
        recipientMembershipId: source.recipientMembershipId,
      },
      update: {},
    });
  }
}
