import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import type { ResourceTarget, TimelineQuery } from '@crm/contracts';
import { TasksRepository } from './tasks.repository.js';
@Injectable()
export class TasksLookupGateway {
  constructor(@Inject(TasksRepository) private readonly repository: TasksRepository) {}
  timeline(
    tx: DatabaseTransaction,
    context: TenantContext,
    target: ResourceTarget,
    query: TimelineQuery,
  ) {
    return this.repository.timeline(tx, context, target, query);
  }
}
