import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { PipelinesController } from './presentation/pipelines.controller.js';
import { PipelinesService } from './application/pipelines.service.js';
import { PipelinesRepository } from './infrastructure/pipelines.repository.js';
import { PipelinesLookupGateway } from './infrastructure/pipelines-lookup.gateway.js';
@Module({
  imports: [DatabaseModule, AccessControlModule, OrganizationsContextModule],
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelinesRepository, PipelinesLookupGateway],
  exports: [PipelinesLookupGateway],
})
export class PipelinesModule {}
