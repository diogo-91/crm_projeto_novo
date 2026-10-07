import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { AssignRole, PermissionCode } from '@crm/contracts';
import type { Principal } from '../../../common/security.js';
import { StructuredLogger } from '../../runtime/index.js';
import { AccessRepository } from '../infrastructure/access.repository.js';
import type { TenantContext } from '../domain/access-policy.js';
@Injectable()
export class AccessControlService {
  constructor(
    @Inject(AccessRepository) private readonly repository: AccessRepository,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  context(principal: Principal) {
    return this.repository.context(principal);
  }
  deliveryContext(transaction: DatabaseTransaction, organizationId: string, membershipId: string) {
    return this.repository.deliveryContext(transaction, organizationId, membershipId);
  }
  platform(principal: Principal, permission: PermissionCode, transaction?: DatabaseTransaction) {
    return this.repository.platform(principal, permission, transaction);
  }
  lockAndAuthorize(
    transaction: DatabaseTransaction,
    context: TenantContext,
    permission: PermissionCode,
    kind: 'organization' | 'collection' = 'organization',
  ) {
    return this.repository.lockAndAuthorize(transaction, context, permission, kind);
  }
  listRoles(context: TenantContext) {
    return this.repository.listRoles(context);
  }
  listPermissions() {
    return this.repository.listPermissions();
  }
  async assign(context: TenantContext, memberId: string, input: AssignRole) {
    const result = await this.repository.assign(context, memberId, input);
    this.logger.info('role assigned', 'access-control', {
      userId: context.userId,
      organizationId: context.organizationId,
      membershipId: memberId,
      entityId: result.id,
    });
    return result;
  }
  async remove(context: TenantContext, memberId: string, grantId: string) {
    await this.repository.remove(context, memberId, grantId);
    this.logger.info('role removed', 'access-control', {
      userId: context.userId,
      organizationId: context.organizationId,
      membershipId: memberId,
      entityId: grantId,
    });
  }
}
