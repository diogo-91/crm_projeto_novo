import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { ContactsModule } from '../contacts/index.js';
import { CompaniesModule } from '../companies/index.js';
import { PipelinesModule } from '../pipelines/index.js';
import { OpportunitiesController } from './presentation/opportunities.controller.js';
import { OpportunitiesService } from './application/opportunities.service.js';
import { OpportunitiesRepository } from './infrastructure/opportunities.repository.js';
import { OpportunitiesGateway } from './infrastructure/opportunities.gateway.js';
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    OrganizationsContextModule,
    ContactsModule,
    CompaniesModule,
    PipelinesModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, OpportunitiesRepository, OpportunitiesGateway],
  exports: [OpportunitiesGateway],
})
export class OpportunitiesModule {}
