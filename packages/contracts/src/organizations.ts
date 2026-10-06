import { z } from 'zod';
import { emailSchema } from './identity.js';
const name = z.string().trim().min(1).max(160);
export const uuidSchema = z.uuid();
export const createOrganizationSchema = z
  .object({
    name,
    legalName: z.string().trim().min(1).max(200).optional(),
    document: z
      .string()
      .trim()
      .toUpperCase()
      .transform((value) => value.replace(/[.\s/-]/g, ''))
      .pipe(z.string().regex(/^[A-Z0-9]{1,64}$/))
      .optional(),
  })
  .strict();
export const createBranchSchema = z
  .object({
    name,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,63}$/),
  })
  .strict();
const branchSelection = {
  branchIds: z.array(uuidSchema).max(100).default([]),
  primaryBranchId: uuidSchema.optional(),
};
export const createOrganizationUserSchema = z
  .object({
    name,
    email: emailSchema,
    ...branchSelection,
  })
  .strict();
export const createMembershipSchema = z.object({ userId: uuidSchema, ...branchSelection }).strict();
export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: uuidSchema.optional(),
  })
  .strict();
const timestamps = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const organizationResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    legalName: z.string().nullable(),
    document: z.string().nullable(),
    active: z.boolean(),
    ...timestamps,
  })
  .strict();
export const branchResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    name: z.string(),
    code: z.string(),
    active: z.boolean(),
    ...timestamps,
  })
  .strict();
export const userResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    email: z.email(),
    active: z.boolean(),
    ...timestamps,
  })
  .strict();
export const membershipResponseSchema = z
  .object({
    id: uuidSchema,
    organizationId: uuidSchema,
    user: userResponseSchema,
    active: z.boolean(),
    primaryBranchId: uuidSchema.nullable(),
    branchIds: z.array(uuidSchema),
    ...timestamps,
  })
  .strict();
const pageInfo = z.object({ nextCursor: uuidSchema.nullable(), hasNextPage: z.boolean() }).strict();
export const branchListResponseSchema = z
  .object({ data: z.array(branchResponseSchema), pageInfo })
  .strict();
export const memberListResponseSchema = z
  .object({ data: z.array(membershipResponseSchema), pageInfo })
  .strict();
export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type CreateBranch = z.infer<typeof createBranchSchema>;
export type CreateOrganizationUser = z.infer<typeof createOrganizationUserSchema>;
export type CreateMembership = z.infer<typeof createMembershipSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
export type BranchResponse = z.infer<typeof branchResponseSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;
export type BranchListResponse = z.infer<typeof branchListResponseSchema>;
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;
