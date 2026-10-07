import { z } from 'zod';
import { uuidSchema, userResponseSchema } from './organizations.js';
import { permissionCodeSchema } from './access-control.js';
import { emailSchema, newPasswordSchema } from './identity.js';
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const emptyBodySchema = z.object({}).strict();
export const selectContextSchema = z.object({ organizationId: uuidSchema }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: newPasswordSchema })
  .strict();
export const availableMembershipSchema = z
  .object({ membershipId: uuidSchema, organizationId: uuidSchema, organizationName: z.string() })
  .strict();
const context = z
  .object({
    organizationId: uuidSchema,
    organizationName: z.string(),
    membershipId: uuidSchema,
    primaryBranchId: uuidSchema.nullable(),
    branches: z.array(z.object({ id: uuidSchema, name: z.string(), code: z.string() }).strict()),
    permissions: z.array(permissionCodeSchema),
    cacheScopeKey: z.string().regex(/^[a-f0-9]{64}$/),
    roles: z.array(
      z
        .object({
          id: uuidSchema,
          code: z.string(),
          name: z.string(),
          scope: z.enum(['OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION']),
        })
        .strict(),
    ),
  })
  .strict();
export const meResponseSchema = z
  .object({
    user: userResponseSchema,
    memberships: z.array(availableMembershipSchema),
    context: context.nullable(),
  })
  .strict();
export const authResponseSchema = meResponseSchema
  .extend({
    accessToken: z.string(),
    expiresIn: z.number().int(),
    sessionExpiresAt: z.iso.datetime(),
  })
  .strict();
export type Login = z.infer<typeof loginSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AvailableMembership = z.infer<typeof availableMembershipSchema>;
