import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { TasksCoreModule } from '../tasks/index.js';
import { OpportunitiesModule } from '../opportunities/index.js';
import { ActivitiesService } from './application/activities.service.js';
import { ActivitiesRepository } from './infrastructure/activities.repository.js';
import { ActivitiesController } from './presentation/activities.controller.js';
@Module({
  imports: [DatabaseModule, AccessControlModule, TasksCoreModule, OpportunitiesModule],
  providers: [ActivitiesService, ActivitiesRepository],
  controllers: [ActivitiesController],
})
export class ActivitiesModule {}
