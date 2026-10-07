import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { LeadsRepository } from './leads.repository.js';
@Injectable()
export class LeadsLookupGateway {
  constructor(@Inject(LeadsRepository) private readonly repository: LeadsRepository) {}
  target(tx: DatabaseTransaction, context: TenantContext, id: string) {
    return this.repository.target(tx, context, id);
  }
}
