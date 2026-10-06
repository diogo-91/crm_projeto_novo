import type { Principal } from '../../../common/security.js';
import type { TenantContext } from '../../access-control/index.js';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateOrganization,
  CreateBranch,
  CreateOrganizationUser,
  CreateMembership,
  ListQuery,
} from '@crm/contracts';
import { OrganizationsRepository } from '../infrastructure/organizations.repository.js';
import { validateBranchSelection } from '../domain/membership-policy.js';
import { StructuredLogger } from '../../runtime/index.js';
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(OrganizationsRepository) private readonly repository: OrganizationsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async createOrganization(input: CreateOrganization, principal: Principal) {
    const result = await this.repository.createOrganization(input, principal);
    this.logger.info('organization created', 'organizations', {
      organizationId: result.id,
      entityId: result.id,
    });
    return result;
  }
  getOrganization(id: string) {
    return this.repository.getOrganization(id);
  }
  async createBranch(id: string, input: CreateBranch, context: TenantContext) {
    const result = await this.repository.createBranch(id, input, context);
    this.logger.info('branch created', 'organizations', {
      organizationId: id,
      entityId: result.id,
    });
    return result;
  }
  listBranches(id: string, query: ListQuery, context: TenantContext) {
    return this.repository.listBranches(id, query, context);
  }
  listMembers(id: string, query: ListQuery, context: TenantContext) {
    return this.repository.listMembers(id, query, context);
  }
  async createUser(id: string, input: CreateOrganizationUser, context: TenantContext) {
    validateBranchSelection(input.branchIds, input.primaryBranchId);
    const result = await this.repository.createUser(id, input, context);
    this.logger.info('identity and membership created', 'organizations', {
      organizationId: id,
      entityId: result.id,
    });
    return result;
  }
  async createMembership(id: string, input: CreateMembership, context: TenantContext) {
    validateBranchSelection(input.branchIds, input.primaryBranchId);
    const result = await this.repository.createMembership(id, input, context);
    this.logger.info('membership created', 'organizations', {
      organizationId: id,
      entityId: result.id,
    });
    return result;
  }
}
