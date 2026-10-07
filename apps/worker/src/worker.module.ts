import { TaskRemindersModule } from '@crm/api/task-reminders';
import { ReminderWorkerService } from './jobs/reminder-worker.service.js';
import { Module } from '@nestjs/common';
import { RuntimeConfigModule, LoggingModule } from '@crm/api/runtime';
import { TechnicalWorkerService } from './jobs/technical-worker.service.js';
@Module({
  imports: [RuntimeConfigModule.forRoot('worker'), LoggingModule, TaskRemindersModule],
  providers: [TechnicalWorkerService, ReminderWorkerService],
})
export class WorkerModule {}
