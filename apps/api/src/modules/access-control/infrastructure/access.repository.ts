import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DatabaseTransaction } from '@crm/database';
import {
  permissionCodeSchema,
  permissionListResponseSchema,
  tenantScopeSchema,
} from '@crm/contracts';
import type { PermissionCode, AssignRole } from '@crm/contracts';
import { DatabaseService } from '../../database/database.module.js';
import { OrganizationsAccessGateway } from '../../organizations/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import type { Principal } from '../../../common/security.js';
import {
  canDelegate,
  orgPermission,
  collectionScope,
  validateGrant,
} from '../domain/access-policy.js';
import type { TenantContext } from '../domain/access-policy.js';
@Injectable()
export class AccessRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(OrganizationsAccessGateway) private readonly organizations: OrganizationsAccessGateway,
  ) {}
  async context(
    principal: Principal,
    transaction: DatabaseTransaction = this.database.client,
  ): Promise<TenantContext> {
    if (!principal.membershipId)
      throw new ApplicationError('FORBIDDEN', 'Select an active organization context.');
    const member = await this.organizations.context(
      principal.userId,
      principal.membershipId,
      transaction,
    );
    if (!member) throw new ApplicationError('FORBIDDEN', 'Organization context unavailable.');
    const assignments = await transaction.userRole.findMany({
      where: {
        organizationId: member.organizationId,
        membershipId: member.id,
        role: { active: true },
      },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        branches: true,
      },
      orderBy: { id: 'asc' },
    });
    return {
      userId: principal.userId,
      sessionId: principal.sessionId,
      contextVersion: principal.contextVersion,
      membershipId: member.id,
      organizationId: member.organizationId,
      organizationName: member.organization.name,
      primaryBranchId: member.primaryBranchId,
      branches: member.branches.map((link) => link.branch),
      grants: assignments.map((assignment) => ({
        id: assignment.id,
        roleId: assignment.roleId,
        code: assignment.role.code,
        name: assignment.role.name,
        scope: tenantScopeSchema.parse(assignment.scope),
        permissions: assignment.role.permissions.map((link) =>
          permissionCodeSchema.parse(link.permission.code),
        ),
        branchIds: assignment.branches.map((link) => link.branchId),
      })),
    };
  }
  async platform(
    principal: Principal,
    permission: PermissionCode,
    transaction: DatabaseTransaction = this.database.client,
  ) {
    const grant = await transaction.platformGrant.findFirst({
      where: {
        userId: principal.userId,
        permission: { code: permission, domain: 'PLATFORM' },
        scope: 'ALL',
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      select: { id: true },
    });
    if (!grant) throw new ApplicationError('FORBIDDEN', 'Explicit platform permission required.');
  }
  async lockAndAuthorize(
    transaction: DatabaseTransaction,
    context: TenantContext,
    permission: PermissionCode,
    kind: 'organization' | 'collection' = 'organization',
  ) {
    await this.lockMembers(transaction, [context.membershipId]);
    await this.assertSession(transaction, context);
    const fresh = await this.context(
      {
        userId: context.userId,
        sessionId: context.sessionId,
        membershipId: context.membershipId,
        contextVersion: context.contextVersion,
      },
      transaction,
    );
    if (fresh.organizationId !== context.organizationId)
      throw new ApplicationError('FORBIDDEN', 'Organization context changed.');
    if (kind === 'collection') collectionScope(fresh, permission);
    else orgPermission(fresh, permission);
    return fresh;
  }
  private async assertSession(transaction: DatabaseTransaction, context: TenantContext) {
    // Read-only security projection; Auth remains the sole writer of sessions.
    const session = await transaction.session.findFirst({
      where: {
        id: context.sessionId,
        userId: context.userId,
        membershipId: context.membershipId,
        contextVersion: context.contextVersion,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true },
      },
      select: { securityVersion: true, user: { select: { securityVersion: true } } },
    });
    if (!session || session.securityVersion !== session.user.securityVersion)
      throw new ApplicationError('UNAUTHENTICATED', 'Invalid credentials or session.');
  }
  private async lockMembers(transaction: DatabaseTransaction, ids: string[]) {
    // Parameterized locking of authoritative membership rows, in deterministic order.
    const first = ids[0];
    const second = ids[1] ?? first;
    if (!first || !second) throw new Error('Membership lock requires IDs');
    await transaction.$queryRaw`SELECT id FROM organization_memberships WHERE id IN (${first}::uuid, ${second}::uuid) ORDER BY id FOR UPDATE`;
  }
  listRoles(context: TenantContext) {
    return this.database.client.role
      .findMany({
        where: { organizationId: context.organizationId },
        include: { permissions: { include: { permission: true } } },
        orderBy: { code: 'asc' },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description,
          active: row.active,
          system: row.system,
          permissions: row.permissions.map((link) =>
            permissionCodeSchema.parse(link.permission.code),
          ),
        })),
      );
  }
  async listPermissions() {
    const rows = await this.database.client.permission.findMany({
      select: { id: true, code: true, description: true, domain: true },
      orderBy: { code: 'asc' },
    });
    return permissionListResponseSchema.parse(rows);
  }
  assign(context: TenantContext, membershipId: string, input: AssignRole) {
    validateGrant(input.scope, input.branchIds);
    return persist(() =>
      this.database.client.$transaction(async (transaction) => {
        await this.lockMembers(transaction, [context.membershipId, membershipId]);
        await this.assertSession(transaction, context);
        const actor = await this.context(
          {
            userId: context.userId,
            sessionId: context.sessionId,
            membershipId: context.membershipId,
            contextVersion: context.contextVersion,
          },
          transaction,
        );
        orgPermission(actor, 'users.manage');
        if (membershipId === actor.membershipId)
          throw new ApplicationError('FORBIDDEN', 'Self modification of roles is prohibited.');
        const target = await transaction.organizationMembership.findFirst({
          where: {
            id: membershipId,
            organizationId: actor.organizationId,
            active: true,
            user: { active: true },
          },
          include: { branches: { where: { branch: { active: true } } } },
        });
        const role = await transaction.role.findFirst({
          where: { id: input.roleId, organizationId: actor.organizationId, active: true },
          include: { permissions: { include: { permission: true } } },
        });
        if (!target || !role)
          throw new ApplicationError(
            'RESOURCE_NOT_FOUND',
            'Membership or role unavailable in this organization.',
          );
        if (input.branchIds.some((id) => !target.branches.some((link) => link.branchId === id)))
          throw new ApplicationError(
            'INVALID_INPUT',
            'Grant branches must belong to the active target membership.',
          );
        if (
          !canDelegate(
            actor,
            role.permissions.map((link) => permissionCodeSchema.parse(link.permission.code)),
            input.scope,
            input.branchIds,
            membershipId,
          )
        )
          throw new ApplicationError('FORBIDDEN', 'Cannot delegate authority above your grants.');
        const branches = [...input.branchIds].sort();
        const scopeKey = branches.length
          ? createHash('sha256').update(branches.join(',')).digest('hex')
          : 'none';
        const grant = await transaction.userRole.create({
          data: {
            organizationId: actor.organizationId,
            membershipId,
            roleId: role.id,
            scope: input.scope,
            scopeKey,
          },
        });
        if (branches.length)
          await transaction.userRoleBranch.createMany({
            data: branches.map((branchId) => ({
              organizationId: actor.organizationId,
              userRoleId: grant.id,
              membershipId,
              branchId,
            })),
          });
        return {
          id: grant.id,
          organizationId: actor.organizationId,
          membershipId,
          roleId: role.id,
          scope: input.scope,
          branchIds: branches,
        };
      }),
    );
  }
  remove(context: TenantContext, membershipId: string, assignmentId: string) {
    return persist(() =>
      this.database.client.$transaction(async (transaction) => {
        await this.lockMembers(transaction, [context.membershipId, membershipId]);
        await this.assertSession(transaction, context);
        const actor = await this.context(
          {
            userId: context.userId,
            sessionId: context.sessionId,
            membershipId: context.membershipId,
            contextVersion: context.contextVersion,
          },
          transaction,
        );
        orgPermission(actor, 'users.manage');
        if (membershipId === actor.membershipId)
          throw new ApplicationError('FORBIDDEN', 'Self modification of roles is prohibited.');
        const grant = await transaction.userRole.findFirst({
          where: { id: assignmentId, membershipId, organizationId: actor.organizationId },
          include: {
            branches: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        });
        if (!grant)
          throw new ApplicationError(
            'RESOURCE_NOT_FOUND',
            'Assignment does not exist in this organization.',
          );
        if (
          !canDelegate(
            actor,
            grant.role.permissions.map((link) => permissionCodeSchema.parse(link.permission.code)),
            tenantScopeSchema.parse(grant.scope),
            grant.branches.map((link) => link.branchId),
            membershipId,
          )
        )
          throw new ApplicationError('FORBIDDEN', 'Cannot manage authority above your grants.');
        await transaction.userRole.delete({ where: { id: grant.id } });
      }),
    );
  }
}
