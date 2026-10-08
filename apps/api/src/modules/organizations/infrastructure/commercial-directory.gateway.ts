import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import type { ListQuery } from '@crm/contracts';
import { UserIdentityGateway } from '../../users/index.js';
import { ApplicationError } from '../../../common/application-error.js';
import { identityPage } from '../../../common/commercial-pagination.js';
@Injectable()
export class CommercialDirectoryGateway {
  constructor(@Inject(UserIdentityGateway) private readonly identities: UserIdentityGateway) {}
  async requireBranch(tx: DatabaseTransaction, organizationId: string, branchId: string) {
    const branch = await tx.branch.findFirst({
      where: { organizationId, id: branchId, active: true },
      select: { id: true },
    });
    if (!branch) throw new ApplicationError('RESOURCE_NOT_FOUND', 'Active branch unavailable.');
  }
  async assignment(
    tx: DatabaseTransaction,
    organizationId: string,
    branchId: string,
    membershipId: string,
  ) {
    const link = await tx.membershipBranch.findFirst({
      where: {
        organizationId,
        branchId,
        membershipId,
        branch: { active: true },
        membership: { active: true, user: { active: true }, organization: { active: true } },
      },
      select: { id: true },
    });
    if (!link)
      throw new ApplicationError(
        'RESOURCE_NOT_FOUND',
        'Active branch and owner assignment unavailable.',
      );
  }
  async branches(
    tx: DatabaseTransaction,
    organizationId: string,
    branchIds: string[] | undefined,
    query: ListQuery,
  ) {
    return identityPage(
      await tx.branch.findMany({
        where: {
          organizationId,
          active: true,
          id: {
            ...(branchIds ? { in: branchIds } : {}),
            ...(query.cursor ? { gt: query.cursor } : {}),
          },
        },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
        take: query.limit + 1,
      }),
      query.limit,
    );
  }
  async owners(
    tx: DatabaseTransaction,
    organizationId: string,
    branchId: string,
    ownMembershipId: string | undefined,
    query: ListQuery,
  ) {
    const rows = await tx.organizationMembership.findMany({
      where: {
        organizationId,
        active: true,
        user: { active: true },
        id: {
          ...(ownMembershipId ? { in: [ownMembershipId] } : {}),
          ...(query.cursor ? { gt: query.cursor } : {}),
        },
        branches: { some: { organizationId, branchId, branch: { active: true } } },
      },
      select: { id: true, userId: true },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
    });
    const users = await this.identities.findPublicMany(
      tx,
      rows.map((row) => row.userId),
    );
    return identityPage(
      rows.map((row) => {
        const user = users.get(row.userId);
        if (!user) throw new Error('Owner identity missing');
        return { id: row.id, name: user.name };
      }),
      query.limit,
    );
  }
  async branchLabels(tx: DatabaseTransaction, organizationId: string, branchIds: string[]) {
    const rows = await tx.branch.findMany({
      where: { organizationId, id: { in: [...new Set(branchIds)] } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }
  async labels(
    tx: DatabaseTransaction,
    organizationId: string,
    records: { branchId: string; ownerMembershipId: string }[],
  ) {
    const [branches, members] = await Promise.all([
      this.branchLabels(
        tx,
        organizationId,
        records.map((row) => row.branchId),
      ),
      tx.organizationMembership.findMany({
        where: {
          organizationId,
          id: { in: [...new Set(records.map((row) => row.ownerMembershipId))] },
        },
        select: { id: true, userId: true },
      }),
    ]);
    const users = await this.identities.findPublicMany(
      tx,
      members.map((row) => row.userId),
    );
    return {
      branches,
      owners: new Map(
        members.map((row) => {
          const user = users.get(row.userId);
          if (!user) throw new Error('Owner identity missing');
          return [row.id, { id: row.id, name: user.name }] as const;
        }),
      ),
    };
  }
}
