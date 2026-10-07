import { TaskRemindersService } from '../infrastructure/task-reminders.service.js';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateTask,
  UpdateTask,
  TaskListQuery,
  AssignmentQuery,
  TimelineQuery,
} from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { TasksRepository } from '../infrastructure/tasks.repository.js';
@Injectable()
export class TasksService {
  constructor(
    @Inject(TaskRemindersService) private readonly reminders: TaskRemindersService,
    @Inject(TasksRepository) private readonly repository: TasksRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  reminder(context: TenantContext, id: string) {
    return this.reminders.status(context, id);
  }
  async retry(context: TenantContext, id: string, version: number) {
    const result = await this.reminders.retry(context, id, version);
    this.log(context, id, 'reminder retry requested');
    return result;
  }
  get(context: TenantContext, id: string) {
    return this.repository.get(context, id);
  }
  list(context: TenantContext, query: TaskListQuery) {
    return this.repository.list(context, query);
  }
  branches(context: TenantContext, query: AssignmentQuery) {
    return this.repository.branches(context, query);
  }
  owners(context: TenantContext, query: AssignmentQuery) {
    return this.repository.owners(context, query);
  }
  history(context: TenantContext, id: string, query: TimelineQuery) {
    return this.repository.history(context, id, query);
  }
  async create(context: TenantContext, input: CreateTask) {
    const row = await this.repository.create(context, input);
    this.log(context, row.id, 'created');
    return row;
  }
  async change(
    context: TenantContext,
    id: string,
    version: number,
    input?: UpdateTask,
    command?: 'complete' | 'reopen' | 'archive',
  ) {
    const row = await this.repository.change(context, id, version, input, command);
    this.log(context, id, command ?? 'updated');
    return row;
  }
  private log(context: TenantContext, id: string, action: string) {
    this.logger.info(`task ${action}`, 'tasks', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
  }
}
