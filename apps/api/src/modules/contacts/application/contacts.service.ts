import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateContact,
  UpdateContact,
  ContactListQuery,
  AssignmentQuery,
} from '@crm/contracts';
import { AccessControlService } from '../../access-control/index.js';
import type { Principal } from '../../../common/security.js';
import type { TenantContext } from '../../access-control/index.js';
import { StructuredLogger } from '../../runtime/index.js';
import { ContactsRepository } from '../infrastructure/contacts.repository.js';
@Injectable()
export class ContactsService {
  constructor(
    @Inject(ContactsRepository) private readonly repository: ContactsRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(AccessControlService) private readonly access: AccessControlService,
  ) {}
  list(context: TenantContext, query: ContactListQuery) {
    return this.repository.list(context, query);
  }
  async create(context: TenantContext, input: CreateContact) {
    const result = await this.repository.create(context, input);
    this.event('contact.created', context, result.id);
    return result;
  }
  async update(context: TenantContext, id: string, input: UpdateContact) {
    const result = await this.repository.update(context, id, input);
    this.event('contact.updated', context, id);
    return result;
  }
  async archive(context: TenantContext, id: string, version: number) {
    const result = await this.repository.archive(context, id, version);
    this.event('contact.deactivated', context, id);
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
    this.logger.info(event, 'contacts', {
      organizationId: context.organizationId,
      membershipId: context.membershipId,
      entityId: id,
    });
  }
}
