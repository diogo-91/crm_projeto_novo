import { Inject, Injectable } from '@nestjs/common';
import type { CreateContact } from '@crm/contracts';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { ContactsRepository } from './contacts.repository.js';
@Injectable()
export class ContactsLookupGateway {
  constructor(@Inject(ContactsRepository) private readonly repository: ContactsRepository) {}
  target(tx: DatabaseTransaction, context: TenantContext, id: string) {
    return this.repository.target(tx, context, id);
  }
  create(tx: DatabaseTransaction, context: TenantContext, input: CreateContact) {
    return this.repository.createInTransaction(tx, context, input);
  }
  labels(tx: DatabaseTransaction, context: TenantContext, ids: string[]) {
    return this.repository.visibleMany(tx, context, ids);
  }
  requireLink(tx: DatabaseTransaction, context: TenantContext, id: string, activeOnly = true) {
    return this.repository.requireLink(tx, context, id, activeOnly);
  }
}
