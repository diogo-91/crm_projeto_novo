import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { CatalogModule } from '../catalog/index.js';
import { ContactsModule } from '../contacts/index.js';
import { CompaniesModule } from '../companies/index.js';
import { OpportunitiesModule } from '../opportunities/index.js';
import { QuotesRepository } from './infrastructure/quotes.repository.js';
import { QuotesService } from './application/quotes.service.js';
import { QuotesController } from './presentation/quotes.controller.js';
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    OrganizationsContextModule,
    CatalogModule,
    ContactsModule,
    CompaniesModule,
    OpportunitiesModule,
  ],
  providers: [QuotesRepository, QuotesService],
  controllers: [QuotesController],
})
export class QuotesModule {}
