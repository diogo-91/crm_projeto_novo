import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { ContactsModule } from '../contacts/index.js';
import { LeadsModule } from '../leads/index.js';
import { OpportunitiesModule } from '../opportunities/index.js';
import { TasksRepository } from './infrastructure/tasks.repository.js';
import { TaskTargetGateway } from './infrastructure/task-target.gateway.js';
import { TasksLookupGateway } from './infrastructure/tasks-lookup.gateway.js';
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    OrganizationsContextModule,
    ContactsModule,
    LeadsModule,
    OpportunitiesModule,
  ],
  providers: [TasksRepository, TaskTargetGateway, TasksLookupGateway],
  exports: [TasksRepository, TaskTargetGateway, TasksLookupGateway],
})
export class TasksCoreModule {}
