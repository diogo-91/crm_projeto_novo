import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { CompaniesLookupGateway } from './infrastructure/companies-lookup.gateway.js';
import { CompaniesController } from './presentation/companies.controller.js';
import { CompaniesService } from './application/companies.service.js';
import { CompaniesRepository } from './infrastructure/companies.repository.js';
@Module({
  imports: [DatabaseModule, AccessControlModule, OrganizationsContextModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository, CompaniesLookupGateway],
  exports: [CompaniesLookupGateway],
})
export class CompaniesModule {}
