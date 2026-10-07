import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AccessControlModule } from '../access-control/index.js';

import { TagsLookupGateway } from './infrastructure/tags-lookup.gateway.js';
import { TagsController } from './presentation/tags.controller.js';
import { TagsService } from './application/tags.service.js';
import { TagsRepository } from './infrastructure/tags.repository.js';
@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [TagsController],
  providers: [TagsService, TagsRepository, TagsLookupGateway],
  exports: [TagsLookupGateway],
})
export class TagsModule {}
