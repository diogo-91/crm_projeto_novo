import { z } from 'zod';
import { uuidSchema } from './organizations.js';
export const permissionCodes = [
  'organizations.create',
  'organizations.read',
  'organizations.manage',
  'branches.read',
  'branches.manage',
  'users.read',
  'users.manage',
  'roles.read',
  'contacts.read',
  'contacts.create',
  'contacts.update',
  'contacts.delete',
  'contacts.assign',
  'companies.read',
  'companies.create',
  'companies.update',
  'companies.delete',
  'companies.assign',
  'tags.read',
  'tags.manage',
  'tasks.read',
  'tasks.create',
  'tasks.update',
  'tasks.delete',
  'tasks.assign',
  'tasks.complete',
  'activities.read',
  'activities.create',
  'notifications.read',
  'notifications.update',
  'leads.read',
  'leads.create',
  'leads.update',
  'leads.delete',
  'leads.assign',
  'leads.convert',
  'pipelines.read',
  'pipelines.manage',
  'opportunities.read',
  'opportunities.create',
  'opportunities.update',
  'opportunities.delete',
  'opportunities.assign',
  'opportunities.move',
] as const;
export const permissionCodeSchema = z.enum(permissionCodes);
export type PermissionCode = z.infer<typeof permissionCodeSchema>;
export const accessScopeSchema = z.enum(['OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION', 'ALL']);
export const tenantScopeSchema = accessScopeSchema.exclude(['ALL']);
export type AccessScope = z.infer<typeof accessScopeSchema>;
export type TenantScope = z.infer<typeof tenantScopeSchema>;
export const assignRoleSchema = z
  .object({
    roleId: uuidSchema,
    scope: tenantScopeSchema,
    branchIds: z.array(uuidSchema).max(100).default([]),
  })
  .strict();
export const roleResponseSchema = z
  .object({
    id: uuidSchema,
    code: z.string(),
    name: z.string(),
    description: z.string(),
    system: z.boolean(),
    active: z.boolean(),
    permissions: z.array(permissionCodeSchema),
  })
  .strict();
export const roleListResponseSchema = z.array(roleResponseSchema);
export const permissionListResponseSchema = z.array(
  z
    .object({
      id: uuidSchema,
      code: permissionCodeSchema,
      description: z.string(),
      domain: z.enum(['ORGANIZATION', 'PLATFORM']),
    })
    .strict(),
);
export const assignmentResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    membershipId: uuidSchema,
    roleId: uuidSchema,
    scope: tenantScopeSchema,
    branchIds: z.array(uuidSchema),
  })
  .strict();
export type AssignRole = z.infer<typeof assignRoleSchema>;
export type RoleResponse = z.infer<typeof roleResponseSchema>;
export type RoleAssignmentResponse = z.infer<typeof assignmentResponseSchema>;
