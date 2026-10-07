import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { ResourceTarget } from '@crm/contracts';
import type { TenantContext } from '../../access-control/index.js';
import { ContactsLookupGateway } from '../../contacts/index.js';
import { LeadsLookupGateway } from '../../leads/index.js';
import { OpportunitiesGateway } from '../../opportunities/index.js';
@Injectable()
export class TaskTargetGateway {
  constructor(
    @Inject(ContactsLookupGateway) private readonly contacts: ContactsLookupGateway,
    @Inject(LeadsLookupGateway) private readonly leads: LeadsLookupGateway,
    @Inject(OpportunitiesGateway) private readonly opportunities: OpportunitiesGateway,
  ) {}
  require(tx: DatabaseTransaction, context: TenantContext, target: ResourceTarget) {
    if (target.type === 'contact') return this.contacts.target(tx, context, target.id);
    if (target.type === 'lead') return this.leads.target(tx, context, target.id);
    return this.opportunities.target(tx, context, target.id);
  }
}
