import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateLead,
  UpdateLead,
  LeadListQuery,
  ConvertLead,
  AssignmentQuery,
} from '@crm/contracts';
import { AccessControlService } from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import type { Principal } from '../../../common/security.js';
import { StructuredLogger } from '../../runtime/index.js';
import { LeadsRepository } from '../infrastructure/leads.repository.js';
@Injectable()
export class LeadsService {
  constructor(
    @Inject(LeadsRepository) private readonly repository: LeadsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  list(context: TenantContext, query: LeadListQuery) {
    return this.repository.list(context, query);
  }
  get(context: TenantContext, id: string) {
    return this.repository.get(context, id);
  }
  async create(context: TenantContext, input: CreateLead) {
    const result = await this.repository.create(context, input);
    this.logger.info('leads.create', 'leads', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: result.id,
    });
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdateLead) {
    const result = await this.repository.update(context, id, input);
    this.logger.info('leads.update', 'leads', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.logger.info('leads.archive', 'leads', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async convert(context: TenantContext, id: string, input: ConvertLead) {
    const result = await this.repository.convert(context, id, input);
    this.logger.info('leads.convert', 'leads', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
    return result;
  }
  async branches(principal: Principal, query: AssignmentQuery) {
    return this.repository.branches(await this.access.context(principal), query);
  }
  async owners(principal: Principal, query: AssignmentQuery) {
    return this.repository.owners(await this.access.context(principal), query);
  }
}
