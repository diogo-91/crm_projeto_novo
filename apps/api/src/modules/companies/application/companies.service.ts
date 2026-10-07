import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateCompany,
  UpdateCompany,
  CompanyListQuery,
  AssignmentQuery,
} from '@crm/contracts';
import { AccessControlService } from '../../access-control/index.js';
import type { Principal } from '../../../common/security.js';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { CompaniesRepository } from '../infrastructure/companies.repository.js';
@Injectable()
export class CompaniesService {
  constructor(
    @Inject(CompaniesRepository) private readonly repository: CompaniesRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  list(context: TenantContext, query: CompanyListQuery) {
    return this.repository.list(context, query);
  }
  async create(context: TenantContext, input: CreateCompany) {
    const result = await this.repository.create(context, input);
    this.event('company.created', context, result.id);
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdateCompany) {
    const result = await this.repository.update(context, id, input);
    this.event('company.updated', context, id);
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.event('company.deactivated', context, id);
    return result;
  }
  get(context: TenantContext, id: string) {
    return this.repository.get(context, id);
  }
  async branches(principal: Principal, query: AssignmentQuery) {
    return this.repository.branches(await this.access.context(principal), query);
  }
  async owners(principal: Principal, query: AssignmentQuery) {
    return this.repository.owners(await this.access.context(principal), query);
  }

  private event(event: string, context: TenantContext, id: string) {
    this.logger.info(event, 'companies', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
  }
}
