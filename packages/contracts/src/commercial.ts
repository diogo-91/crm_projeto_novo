import { z } from 'zod';
import { emailSchema } from './identity.js';
import { uuidSchema, listQuerySchema } from './organizations.js';
export const contactSources = [
  'MANUAL',
  'WHATSAPP',
  'MARKETPLACE',
  'WEBSITE',
  'REFERRAL',
  'OUTBOUND',
  'PHONE',
  'IMPORT',
  'OTHER',
] as const;
export const contactSourceSchema = z.enum(contactSources);
export const tagVariantSchema = z.enum([
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
  'info',
]);
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, '');
}
export function normalizeDocument(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.\s/-]/g, '');
}
export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
export const phoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine(
    (value) => /^\+?[0-9]{7,15}$/.test(normalizePhone(value)),
    'Informe entre 7 e 15 dígitos, com DDI explícito quando internacional.',
  );
export const commercialDocumentSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => /^[A-Z0-9]{1,64}$/.test(normalizeDocument(value)), 'Documento inválido.');
const name = z.string().trim().min(1, 'Informe o nome.').max(160);
const optionalText = z.string().trim().max(4000).nullable().optional();
const fields = {
  name,
  branchId: uuidSchema,
  ownerMembershipId: uuidSchema.optional(),
  email: emailSchema.nullable().optional(),
  document: commercialDocumentSchema.nullable().optional(),
  notes: optionalText,
};
const tagIds = z
  .array(uuidSchema)
  .max(30)
  .refine((ids) => new Set(ids).size === ids.length, 'Tags repetidas.');
export const createContactSchema = z
  .object({
    ...fields,
    phone: phoneSchema,
    companyId: uuidSchema.nullable().optional(),
    source: contactSourceSchema.default('MANUAL'),
    tagIds: tagIds.default([]),
  })
  .strict();
export const createCompanySchema = z
  .object({
    ...fields,
    phone: phoneSchema.nullable().optional(),
    legalName: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();
export const updateContactSchema = createContactSchema
  .omit({ source: true, tagIds: true })
  .partial()
  .extend({ source: contactSourceSchema.optional(), tagIds: tagIds.optional() })
  .extend({ expectedVersion: z.number().int().min(1) })
  .strict();
export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({ expectedVersion: z.number().int().min(1) })
  .strict();
export const archiveSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();
export const createTagSchema = z
  .object({ name: z.string().trim().min(1).max(80), variant: tagVariantSchema.default('neutral') })
  .strict();
export const updateTagSchema = createTagSchema
  .omit({ variant: true })
  .partial()
  .extend({ variant: tagVariantSchema.optional() })
  .extend({ expectedVersion: z.number().int().min(1) })
  .strict();
export const commercialListQuerySchema = listQuerySchema.extend({
  search: z.string().trim().max(160).optional(),
  branchId: uuidSchema.optional(),
  ownerMembershipId: uuidSchema.optional(),
  active: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
// Cursor carries only position (no authority); validated and scoped again by the backend.
const cursorSchema = z.string().max(768).optional();
export const companyListQuerySchema = commercialListQuerySchema
  .extend({ cursor: cursorSchema, document: commercialDocumentSchema.optional() })
  .strict();
export const contactListQuerySchema = commercialListQuerySchema
  .extend({
    cursor: cursorSchema,
    companyId: uuidSchema.optional(),
    tagId: uuidSchema.optional(),
    source: contactSourceSchema.optional(),
  })
  .strict();
export const tagListQuerySchema = listQuerySchema
  .extend({
    active: z.enum(['true', 'false']).optional(),
    search: z.string().trim().max(80).optional(),
  })
  .strict();
export const assignmentQuerySchema = listQuerySchema
  .extend({
    action: z.enum(['create', 'update', 'read']).default('create'),
    branchId: uuidSchema.optional(),
  })
  .strict();
const named = z.object({ id: uuidSchema, name: z.string() }).strict();
export const assignmentListResponseSchema = z
  .object({
    data: z.array(named),
    pageInfo: z.object({ nextCursor: uuidSchema.nullable(), hasNextPage: z.boolean() }).strict(),
  })
  .strict();
const timestamps = {
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().min(1),
};
export const tagResponseSchema = z
  .object({
    ...timestamps,
    id: uuidSchema,
    name: z.string(),
    variant: tagVariantSchema,
    active: z.boolean(),
  })
  .strict();
const pageInfoSchema = z
  .object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() })
  .strict();
export const tagListResponseSchema = z
  .object({ data: z.array(tagResponseSchema), pageInfo: pageInfoSchema })
  .strict();
const responseFields = {
  ...timestamps,
  id: uuidSchema,
  name: z.string(),
  email: z.string().nullable(),
  document: z.string().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
  branch: named,
  owner: named,
};
export const companyResponseSchema = z
  .object({ ...responseFields, phone: z.string().nullable(), legalName: z.string().nullable() })
  .strict();
export const contactResponseSchema = z
  .object({
    ...responseFields,
    phone: z.string(),
    source: contactSourceSchema,
    company: named.nullable(),
    tags: z.array(tagResponseSchema),
  })
  .strict();
export const companyListResponseSchema = z
  .object({ data: z.array(companyResponseSchema), pageInfo: pageInfoSchema })
  .strict();
export const contactListResponseSchema = z
  .object({ data: z.array(contactResponseSchema), pageInfo: pageInfoSchema })
  .strict();
export type CreateContact = z.output<typeof createContactSchema>;
export type UpdateContact = z.output<typeof updateContactSchema>;
export type CreateCompany = z.output<typeof createCompanySchema>;
export type UpdateCompany = z.output<typeof updateCompanySchema>;
export type CreateTag = z.output<typeof createTagSchema>;
export type UpdateTag = z.output<typeof updateTagSchema>;
export type ContactResponse = z.output<typeof contactResponseSchema>;
export type CompanyResponse = z.output<typeof companyResponseSchema>;
export type TagResponse = z.output<typeof tagResponseSchema>;
export type ContactListQuery = z.output<typeof contactListQuerySchema>;
export type CompanyListQuery = z.output<typeof companyListQuerySchema>;
export type TagListQuery = z.output<typeof tagListQuerySchema>;
export type AssignmentQuery = z.output<typeof assignmentQuerySchema>;
