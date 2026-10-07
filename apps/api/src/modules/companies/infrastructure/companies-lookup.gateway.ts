import { Inject, Injectable } from '@nestjs/common';
import type { CreateCompany } from '@crm/contracts';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { CompaniesRepository } from './companies.repository.js';
@Injectable()
export class CompaniesLookupGateway {
  constructor(@Inject(CompaniesRepository) private readonly repository: CompaniesRepository) {}
  create(tx: DatabaseTransaction, context: TenantContext, input: CreateCompany) {
    return this.repository.createInTransaction(tx, context, input);
  }
  labels(tx: DatabaseTransaction, context: TenantContext, ids: string[]) {
    return this.repository.visibleMany(tx, context, ids);
  }
  requireLink(tx: DatabaseTransaction, context: TenantContext, id: string, activeOnly = true) {
    return this.repository.requireLink(tx, context, id, activeOnly);
  }
}
