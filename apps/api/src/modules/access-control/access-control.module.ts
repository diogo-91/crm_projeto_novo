import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { AccessControlService } from './application/access-control.service.js';
import { AccessRepository } from './infrastructure/access.repository.js';
import { AccessBootstrapGateway } from './infrastructure/access-bootstrap.gateway.js';
import { AccessControlController } from './presentation/access-control.controller.js';
@Module({
  imports: [DatabaseModule, OrganizationsContextModule],
  providers: [AccessRepository, AccessControlService, AccessBootstrapGateway],
  controllers: [AccessControlController],
  exports: [AccessControlService, AccessBootstrapGateway],
})
export class AccessControlModule {}
