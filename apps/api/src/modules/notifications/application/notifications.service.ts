import { Inject, Injectable } from '@nestjs/common';
import type { NotificationQuery } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { NotificationsRepository } from '../infrastructure/notifications.repository.js';
import { StructuredLogger } from '../../runtime/index.js';
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository) private readonly repository: NotificationsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  list(context: TenantContext, query: NotificationQuery) {
    return this.repository.list(context, query);
  }
  async read(context: TenantContext, id: string) {
    const row = await this.repository.read(context, id);
    this.logger.info('notification read', 'notifications', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return row;
  }
}
