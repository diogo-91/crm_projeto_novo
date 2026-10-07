import { LeadsLookupGateway } from './infrastructure/leads-lookup.gateway.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { ContactsModule } from '../contacts/index.js';
import { CompaniesModule } from '../companies/index.js';
import { OpportunitiesModule } from '../opportunities/index.js';
import { LeadsController } from './presentation/leads.controller.js';
import { LeadsService } from './application/leads.service.js';
import { LeadsRepository } from './infrastructure/leads.repository.js';
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    OrganizationsContextModule,
    ContactsModule,
    CompaniesModule,
    OpportunitiesModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, LeadsLookupGateway],
  exports: [LeadsLookupGateway],
})
export class LeadsModule {}
