import type { TimelineQuery } from '@crm/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateOpportunity } from '@crm/contracts';
import type { DatabaseTransaction } from '@crm/database';
import type { TenantContext } from '../../access-control/index.js';
import { OpportunitiesRepository } from './opportunities.repository.js';
@Injectable()
export class OpportunitiesGateway {
  constructor(
    @Inject(OpportunitiesRepository) private readonly repository: OpportunitiesRepository,
  ) {}
  target(tx: DatabaseTransaction, context: TenantContext, id: string) {
    return this.repository.target(tx, context, id);
  }
  create(
    tx: DatabaseTransaction,
    context: TenantContext,
    input: CreateOpportunity,
    leadId: string,
  ) {
    return this.repository.createInTransaction(tx, context, input, leadId);
  }
  get(tx: DatabaseTransaction, context: TenantContext, id: string) {
    return this.repository.getInTransaction(tx, context, id);
  }
  timeline(tx: DatabaseTransaction, context: TenantContext, id: string, query: TimelineQuery) {
    return this.repository.timeline(tx, context, id, query);
  }
  labelsByLead(tx: DatabaseTransaction, context: TenantContext, leadIds: string[]) {
    return this.repository.labelsByLead(tx, context, leadIds);
  }
}
