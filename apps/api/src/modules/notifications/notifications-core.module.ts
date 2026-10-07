import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { NotificationsRepository } from './infrastructure/notifications.repository.js';
import { NotificationsDeliveryGateway } from './infrastructure/notifications-delivery.gateway.js';
@Module({
  imports: [DatabaseModule, AccessControlModule],
  providers: [NotificationsRepository, NotificationsDeliveryGateway],
  exports: [NotificationsRepository, NotificationsDeliveryGateway],
})
export class NotificationsCoreModule {}
