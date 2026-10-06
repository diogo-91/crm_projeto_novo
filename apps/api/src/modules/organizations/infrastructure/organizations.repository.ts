import {
  AccessControlService,
  AccessBootstrapGateway,
  collectionScope,
} from '../../access-control/index.js';
import type { TenantContext } from '../../access-control/index.js';
import type { Principal } from '../../../common/security.js';
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import type {
  CreateOrganization,
  CreateBranch,
  CreateOrganizationUser,
  CreateMembership,
  ListQuery,
  MembershipResponse,
  UserResponse,
  OrganizationResponse,
  BranchResponse,
} from '@crm/contracts';
import { DatabaseService } from '../../database/database.module.js';
import { UserIdentityGateway } from '../../users/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { persist } from '../../../common/persistence-errors.js';
import { requireActiveOrganization } from '../domain/membership-policy.js';
function organizationResponse(row: Prisma.OrganizationGetPayload<undefined>): OrganizationResponse {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    document: row.document,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function branchResponse(row: Prisma.BranchGetPayload<undefined>): BranchResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    code: row.code,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
const memberInclude = {
  branches: { orderBy: { branchId: 'asc' } },
} satisfies Prisma.OrganizationMembershipInclude;
type MemberRow = Prisma.OrganizationMembershipGetPayload<{ include: typeof memberInclude }>;
function membershipResponse(row: MemberRow, user: UserResponse): MembershipResponse {
  return {
    id: row.id,
    organizationId: row.organizationId,
    active: row.active,
    primaryBranchId: row.primaryBranchId,
    branchIds: row.branches.map((branch) => branch.branchId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user,
  };
}
function page<T extends { id: string }>(rows: T[], limit: number) {
  const data = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  return {
    data,
    pageInfo: { hasNextPage, nextCursor: hasNextPage ? (data.at(-1)?.id ?? null) : null },
  };
}
@Injectable()
export class OrganizationsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessControlService) private readonly access: AccessControlService,
    @Inject(AccessBootstrapGateway) private readonly bootstrap: AccessBootstrapGateway,
    @Inject(UserIdentityGateway) private readonly identities: UserIdentityGateway,
  ) {}
  createOrganization(input: CreateOrganization, principal: Principal) {
    return persist(() =>
      this.database.client.$transaction(
        async (transaction) => {
          await this.access.platform(principal, 'organizations.create', transaction);
          const row = await transaction.organization.create({
            data: {
              name: input.name,
              legalName: input.legalName ?? null,
              document: input.document ?? null,
            },
          });
          const member = await transaction.organizationMembership.create({
            data: { organizationId: row.id, userId: principal.userId },
          });
          await this.bootstrap.provision(transaction, row.id, member.id);
          return organizationResponse(row);
        },
        { timeout: 10000 },
      ),
    );
  }
  async getOrganization(id: string) {
    const row = await this.database.client.organization.findUnique({ where: { id } });
    if (!row) throw new ApplicationError('ORGANIZATION_NOT_FOUND', 'Organization does not exist.');
    return organizationResponse(row);
  }
  createBranch(organizationId: string, input: CreateBranch, context: TenantContext) {
    return persist(() =>
      this.database.client.$transaction(async (transaction) => {
        await this.access.lockAndAuthorize(transaction, context, 'branches.manage');
        await this.activeOrganization(transaction, organizationId);
        const row = await transaction.branch.create({
          data: { organizationId, name: input.name, code: input.code },
        });
        return branchResponse(row);
      }),
    );
  }
  async listBranches(organizationId: string, query: ListQuery, context: TenantContext) {
    await this.getOrganization(organizationId);
    const scope = collectionScope(context, 'branches.read');
    const branchIds = [
      ...scope.branchIds,
      ...(scope.own ? context.branches.map((branch) => branch.id) : []),
    ];
    const rows = await this.database.client.branch.findMany({
      where: {
        organizationId,
        ...(scope.organization ? {} : { id: { in: branchIds } }),
        ...(query.cursor
          ? { id: { gt: query.cursor, ...(scope.organization ? {} : { in: branchIds }) } }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    return page(rows.map(branchResponse), query.limit);
  }
  async listMembers(organizationId: string, query: ListQuery, context: TenantContext) {
    await this.getOrganization(organizationId);
    const scope = collectionScope(context, 'users.read');
    const rows = await this.database.client.organizationMembership.findMany({
      where: {
        organizationId,
        ...(scope.organization
          ? {}
          : {
              OR: [
                ...(scope.own ? [{ id: context.membershipId }] : []),
                {
                  branches: {
                    some: { branchId: { in: scope.branchIds }, branch: { active: true } },
                  },
                },
              ],
            }),
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      include: memberInclude,
    });
    const users = await this.identities.findPublicMany(
      this.database.client,
      rows.map((row) => row.userId),
    );
    return page(
      rows.map((row) => {
        const user = users.get(row.userId);
        if (!user) throw new Error('Membership identity is missing');
        const result = membershipResponse(row, user);
        if (!scope.organization) {
          result.branchIds = result.branchIds.filter(
            (id) =>
              scope.branchIds.includes(id) ||
              (scope.own &&
                row.id === context.membershipId &&
                context.branches.some((branch) => branch.id === id)),
          );
          if (result.primaryBranchId && !result.branchIds.includes(result.primaryBranchId))
            result.primaryBranchId = null;
        }
        return result;
      }),
      query.limit,
    );
  }
  createUser(organizationId: string, input: CreateOrganizationUser, context: TenantContext) {
    return this.addMember(organizationId, input, context, (transaction) =>
      this.identities.create(transaction, { name: input.name, email: input.email }),
    );
  }
  createMembership(organizationId: string, input: CreateMembership, context: TenantContext) {
    return this.addMember(organizationId, input, context, (transaction) =>
      this.identities.findActive(transaction, input.userId),
    );
  }
  private async activeOrganization(transaction: DatabaseTransaction, id: string): Promise<void> {
    const organization = await transaction.organization.findUnique({
      where: { id },
      select: { active: true },
    });
    requireActiveOrganization(organization);
  }
  private addMember(
    organizationId: string,
    input: Pick<CreateMembership, 'branchIds' | 'primaryBranchId'>,
    context: TenantContext,
    identity: (transaction: DatabaseTransaction) => Promise<UserResponse>,
  ) {
    return persist(() =>
      this.database.client.$transaction(async (transaction) => {
        await this.access.lockAndAuthorize(transaction, context, 'users.manage');
        await this.activeOrganization(transaction, organizationId);
        if (input.branchIds.length > 0) {
          const branches = await transaction.branch.findMany({
            where: { organizationId, id: { in: input.branchIds } },
            select: { id: true, active: true },
          });
          if (branches.length !== input.branchIds.length)
            throw new ApplicationError(
              'BRANCH_NOT_FOUND',
              'A branch does not belong to this organization.',
            );
          if (branches.some((branch) => !branch.active))
            throw new ApplicationError(
              'BRANCH_INACTIVE',
              'Inactive branches cannot receive new memberships.',
            );
        }
        const user = await identity(transaction);
        const member = await transaction.organizationMembership.create({
          data: { organizationId, userId: user.id },
        });
        if (input.branchIds.length > 0)
          await transaction.membershipBranch.createMany({
            data: input.branchIds.map((branchId) => ({
              organizationId,
              membershipId: member.id,
              branchId,
            })),
          });
        const result = await transaction.organizationMembership.update({
          where: { id: member.id },
          data: { primaryBranchId: input.primaryBranchId ?? null },
          include: memberInclude,
        });
        return membershipResponse(result, user);
      }),
    );
  }
}
