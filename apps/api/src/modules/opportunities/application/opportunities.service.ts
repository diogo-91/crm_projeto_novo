import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateOpportunity,
  UpdateOpportunity,
  OpportunityListQuery,
  MoveOpportunity,
  ListQuery,
  AssignmentQuery,
} from '@crm/contracts';
import { AccessControlService } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import type { Principal } from '../../../common/security.js';
import { StructuredLogger } from '../../runtime/index.js';
import { OpportunitiesRepository } from '../infrastructure/opportunities.repository.js';
@Injectable()
export class OpportunitiesService {
  constructor(
    @Inject(OpportunitiesRepository) private readonly repository: OpportunitiesRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  list(context: TenantContext, query: OpportunityListQuery) {
    return this.repository.list(context, query);
  }
  get(context: TenantContext, id: string) {
    return this.repository.get(context, id);
  }
  async create(context: TenantContext, input: CreateOpportunity) {
    const result = await this.repository.create(context, input);
    this.logger.info('opportunities.create', 'opportunities', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: result.id,
    });
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdateOpportunity) {
    const result = await this.repository.update(context, id, input);
    this.logger.info('opportunities.update', 'opportunities', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.logger.info('opportunities.archive', 'opportunities', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async move(context: TenantContext, id: string, input: MoveOpportunity) {
    const result = await this.repository.move(context, id, input);
    this.logger.info('opportunities.move', 'opportunities', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async history(context: TenantContext, id: string, query: ListQuery) {
    const result = await this.repository.history(context, id, query);
    return result;
  }
  async branches(principal: Principal, query: AssignmentQuery) {
    return this.repository.branches(await this.access.context(principal), query);
  }
  async owners(principal: Principal, query: AssignmentQuery) {
    return this.repository.owners(await this.access.context(principal), query);
  }
}
