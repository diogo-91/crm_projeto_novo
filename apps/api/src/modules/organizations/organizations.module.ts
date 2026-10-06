import { AccessControlModule } from '../access-control/index.js';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { UsersModule } from '../users/index.js';
import { OrganizationsController } from './presentation/organizations.controller.js';
import { OrganizationsService } from './application/organizations.service.js';
import { OrganizationsRepository } from './infrastructure/organizations.repository.js';
@Module({
  imports: [DatabaseModule, UsersModule, AccessControlModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
})
export class OrganizationsModule {}
