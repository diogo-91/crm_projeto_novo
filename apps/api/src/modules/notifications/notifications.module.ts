import { NotificationsService } from './application/notifications.service.js';
import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from './notifications-core.module.js';
import { NotificationsController } from './presentation/notifications.controller.js';
@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
