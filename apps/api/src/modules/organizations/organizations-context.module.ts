import { CommercialDirectoryGateway } from './infrastructure/commercial-directory.gateway.js';
import { UsersModule } from '../users/index.js';
import { Inject, Injectable, Module } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import { DatabaseModule, DatabaseService } from '../database/database.module.js';
@Injectable()
export class OrganizationsAccessGateway {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async available(userId: string, transaction: DatabaseTransaction = this.database.client) {
    const rows = await transaction.organizationMembership.findMany({
      where: { userId, active: true, organization: { active: true } },
      select: { id: true, organizationId: true, organization: { select: { name: true } } },
      orderBy: { organizationId: 'asc' },
    });
    return rows.map((row) => ({
      membershipId: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
    }));
  }
  async context(
    userId: string,
    membershipId: string,
    transaction: DatabaseTransaction = this.database.client,
  ) {
    return transaction.organizationMembership.findFirst({
      where: {
        id: membershipId,
        userId,
        active: true,
        user: { active: true },
        organization: { active: true },
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        primaryBranchId: true,
        organization: { select: { name: true } },
        branches: {
          where: { branch: { active: true } },
          select: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  }
  async deliveryContext(
    transaction: DatabaseTransaction,
    organizationId: string,
    membershipId: string,
  ) {
    const member = await transaction.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      select: { userId: true },
    });
    return member ? this.context(member.userId, membershipId, transaction) : null;
  }
  async lockEmptyInstallation(transaction: DatabaseTransaction) {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(187046132, 1)`;
    if ((await transaction.organization.count()) !== 0)
      throw new Error('Initial setup requires an empty installation');
  }
  async createInitialOrganization(
    transaction: DatabaseTransaction,
    userId: string,
    input: { organizationName: string; branchName: string; branchCode: string },
  ) {
    const organization = await transaction.organization.create({
      data: { name: input.organizationName },
      select: { id: true },
    });
    const branch = await transaction.branch.create({
      data: { organizationId: organization.id, name: input.branchName, code: input.branchCode },
      select: { id: true },
    });
    const membership = await transaction.organizationMembership.create({
      data: { organizationId: organization.id, userId },
      select: { id: true },
    });
    await transaction.membershipBranch.create({
      data: { organizationId: organization.id, membershipId: membership.id, branchId: branch.id },
    });
    await transaction.organizationMembership.update({
      where: { id: membership.id },
      data: { primaryBranchId: branch.id },
    });
    return { organizationId: organization.id, membershipId: membership.id };
  }
  async seed(transaction: DatabaseTransaction, userId: string) {
    const organizationId = '9b150a17-f00e-4f2c-8730-513ff1fc9801';
    await transaction.infrastructureMetadata.upsert({
      where: { key: 'foundation' },
      create: { key: 'foundation', version: 1 },
      update: {},
    });
    await transaction.organization.upsert({
      where: { id: organizationId },
      create: { id: organizationId, name: 'Organização Demo' },
      update: {},
    });
    const names = ['Loja 1', 'Loja 2', 'Loja 3', 'Tatuí', 'Votorantim'];
    const codes = ['LOJA_1', 'LOJA_2', 'LOJA_3', 'TATUI', 'VOTORANTIM'];
    const branches: string[] = [];
    for (const [index, name] of names.entries()) {
      const code = codes[index];
      if (!code) throw new Error('Seed branch code missing');
      const row = await transaction.branch.upsert({
        where: { organizationId_code: { organizationId, code: code } },
        create: { organizationId, name, code: code },
        update: {},
      });
      branches.push(row.id);
    }
    const member = await transaction.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: { organizationId, userId },
      update: {},
    });
    for (const branchId of branches)
      await transaction.membershipBranch.upsert({
        where: {
          organizationId_membershipId_branchId: {
            organizationId,
            membershipId: member.id,
            branchId,
          },
        },
        create: { organizationId, membershipId: member.id, branchId },
        update: {},
      });
    if (member.primaryBranchId === null && branches[0])
      await transaction.organizationMembership.update({
        where: { id: member.id },
        data: { primaryBranchId: branches[0] },
      });
    return { organizationId, membershipId: member.id };
  }
}
@Module({
  imports: [DatabaseModule, UsersModule],
  providers: [OrganizationsAccessGateway, CommercialDirectoryGateway],
  exports: [OrganizationsAccessGateway, CommercialDirectoryGateway],
})
export class OrganizationsContextModule {}
