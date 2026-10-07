import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { TagsRepository } from './tags.repository.js';
@Injectable()
export class TagsLookupGateway {
  constructor(@Inject(TagsRepository) private readonly repository: TagsRepository) {}
  labels(tx: DatabaseTransaction, context: TenantContext, contactIds: string[]) {
    return this.repository.labels(tx, context, contactIds);
  }
  requireLinks(tx: DatabaseTransaction, context: TenantContext, ids: string[], activeOnly = true) {
    return this.repository.requireLinks(tx, context, ids, activeOnly);
  }
}
