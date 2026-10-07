import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { CompaniesModule } from '../companies/index.js';
import { TagsModule } from '../tags/index.js';
import { ContactsController } from './presentation/contacts.controller.js';
import { ContactsService } from './application/contacts.service.js';
import { ContactsRepository } from './infrastructure/contacts.repository.js';
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    OrganizationsContextModule,
    CompaniesModule,
    TagsModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
