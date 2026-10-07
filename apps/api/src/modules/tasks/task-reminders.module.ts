import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { NotificationsCoreModule } from '../notifications/index.js';
import { TaskRemindersService } from './infrastructure/task-reminders.service.js';
@Module({
  imports: [DatabaseModule, AccessControlModule, NotificationsCoreModule],
  providers: [TaskRemindersService],
  exports: [TaskRemindersService],
})
export class TaskRemindersModule {}
export { TaskRemindersService } from './infrastructure/task-reminders.service.js';

export { reminderDelay } from './domain/task-policy.js';
