import { Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import { catalog, templates } from '../domain/catalog.js';
@Injectable()
export class AccessBootstrapGateway {
  async provision(transaction: DatabaseTransaction, organizationId: string, membershipId: string) {
    for (const item of catalog)
      await transaction.permission.upsert({ where: { code: item.code }, create: item, update: {} });
    for (const template of templates) {
      const role = await transaction.role.upsert({
        where: { organizationId_code: { organizationId, code: template.code } },
        create: {
          organizationId,
          code: template.code,
          name: template.name,
          description: template.name,
          system: true,
        },
        update: {},
      });
      for (const code of template.permissions) {
        const permission = await transaction.permission.findUniqueOrThrow({ where: { code } });
        await transaction.rolePermission.upsert({
          where: {
            organizationId_roleId_permissionId: {
              organizationId,
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          create: { organizationId, roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
      if (template.code === 'ADMIN')
        await transaction.userRole.upsert({
          where: {
            organizationId_membershipId_roleId_scope_scopeKey: {
              organizationId,
              membershipId,
              roleId: role.id,
              scope: 'ORGANIZATION',
              scopeKey: 'none',
            },
          },
          create: { organizationId, membershipId, roleId: role.id, scope: 'ORGANIZATION' },
          update: {},
        });
    }
  }
  async platformSeed(transaction: DatabaseTransaction, userId: string) {
    const permission = await transaction.permission.findUniqueOrThrow({
      where: { code: 'organizations.create' },
    });
    await transaction.platformGrant.upsert({
      where: { userId_permissionId: { userId, permissionId: permission.id } },
      create: {
        userId,
        permissionId: permission.id,
        reason: 'Explicit local demo organization provisioning',
        expiresAt: new Date(Date.now() + 86400000),
      },
      update: {},
    });
  }
}
