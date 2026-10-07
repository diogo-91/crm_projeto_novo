import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import { NotificationsRepository } from './notifications.repository.js';
@Injectable()
export class NotificationsDeliveryGateway {
  constructor(
    @Inject(NotificationsRepository) private readonly repository: NotificationsRepository,
  ) {}
  async deliver(
    tx: DatabaseTransaction,
    source: { id: string; organizationId: string; recipientMembershipId: string },
  ): Promise<void> {
    await this.repository.deliver(tx, source);
  }
}
