import { TaskRemindersModule } from './task-reminders.module.js';
import { Module } from '@nestjs/common';
import { TasksCoreModule } from './tasks-core.module.js';
import { TasksService } from './application/tasks.service.js';
import { TasksController } from './presentation/tasks.controller.js';
@Module({
  imports: [TasksCoreModule, TaskRemindersModule],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
