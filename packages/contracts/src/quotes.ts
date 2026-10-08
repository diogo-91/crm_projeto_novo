import { z } from 'zod';
import { uuidSchema } from './organizations.js';
import { commercialListQuerySchema } from './commercial.js';
import { currencySchema, unitPriceSchema } from './money.js';
export const quantitySchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'Informe quantidade positiva com até seis casas decimais.')
  .refine((value) => /[1-9]/.test(value), 'Quantidade deve ser positiva.');
export const discountSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Informe desconto percentual com até duas casas.')
  .pipe(
    z.string().refine((value) => {
      const [whole = '0', fraction = ''] = value.split('.');
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')) <= 10000n;
    }, 'Desconto deve estar entre 0 e 100.'),
  );
export const quoteLineInputSchema = z
  .object({
    productId: uuidSchema,
    quantity: quantitySchema,
    discountPercent: discountSchema.default('0'),
  })
  .strict();
const lines = z
  .array(quoteLineInputSchema)
  .min(1)
  .max(100)
  .refine(
    (items) => new Set(items.map((item) => item.productId)).size === items.length,
    'Produto repetido.',
  );
const content = {
  items: lines,
  validUntil: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
};
export const createQuoteSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    branchId: uuidSchema,
    contactId: uuidSchema.nullable().optional(),
    companyId: uuidSchema.nullable().optional(),
    opportunityId: uuidSchema.nullable().optional(),
    priceListId: uuidSchema,
    ...content,
  })
  .strict()
  .refine((value) => Boolean(value.contactId) !== Boolean(value.companyId), {
    message: 'Selecione um cliente ou uma empresa.',
    path: ['contactId'],
  });
export const updateQuoteSchema = z
  .object({ expectedVersion: z.number().int().min(1), ...content })
  .strict();
export const quoteCommandSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, 'Idempotency-Key obrigatório: 16 a 128 caracteres seguros.');
export const quoteStatusSchema = z.enum(['DRAFT', 'APPROVED']);
export const quoteQuerySchema = commercialListQuerySchema
  .omit({ active: true })
  .extend({
    cursor: z.string().max(768).optional(),
    status: quoteStatusSchema.optional(),
    opportunityId: uuidSchema.optional(),
  })
  .strict();
const settled = z.string().regex(/^\d{1,15}\.\d{2}$/);
export const buyerSnapshotSchema = z
  .object({
    name: z.string(),
    document: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .strict();
export const quoteItemResponseSchema = z
  .object({
    productId: uuidSchema,
    sku: z.string(),
    description: z.string(),
    unit: z.string(),
    quantity: quantitySchema,
    unitPrice: unitPriceSchema,
    discountPercent: discountSchema,
    subtotal: settled,
    discount: settled,
    total: settled,
  })
  .strict();
export const quoteSummarySchema = z
  .object({
    id: uuidSchema,
    rootQuoteId: uuidSchema,
    previousQuoteId: uuidSchema.nullable(),
    revision: z.number().int().min(1),
    name: z.string(),
    branchId: uuidSchema,
    ownerMembershipId: uuidSchema,
    opportunityId: uuidSchema.nullable(),
    currency: currencySchema,
    status: quoteStatusSchema,
    subtotal: settled,
    discount: settled,
    total: settled,
    version: z.number().int().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const quoteResponseSchema = quoteSummarySchema
  .extend({
    contactId: uuidSchema.nullable(),
    companyId: uuidSchema.nullable(),
    buyer: buyerSnapshotSchema,
    priceListId: uuidSchema,
    priceListName: z.string(),
    validUntil: z.iso.date().nullable(),
    notes: z.string().nullable(),
    approvedAt: z.iso.datetime().nullable(),
    items: z.array(quoteItemResponseSchema).min(1).max(100),
    canUpdate: z.boolean(),
    canApprove: z.boolean(),
    canRevise: z.boolean(),
  })
  .strict();
export const quoteListResponseSchema = z
  .object({
    data: z.array(quoteSummarySchema),
    pageInfo: z.object({ hasNextPage: z.boolean(), nextCursor: z.string().nullable() }).strict(),
  })
  .strict();
const quoteHistoryItemSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(['CREATED', 'UPDATED', 'APPROVED', 'REVISED']),
    recordVersion: z.number().int().min(1),
    actorMembershipId: uuidSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export const quoteHistoryQuerySchema = z
  .object({
    afterVersion: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const quoteHistoryResponseSchema = z
  .object({
    data: z.array(quoteHistoryItemSchema),
    pageInfo: z.object({ hasNextPage: z.boolean(), nextCursor: z.string().nullable() }).strict(),
  })
  .strict();
export type QuoteHistoryQuery = z.infer<typeof quoteHistoryQuerySchema>;
export type CreateQuote = z.infer<typeof createQuoteSchema>;
export type UpdateQuote = z.infer<typeof updateQuoteSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type QuoteSummary = z.infer<typeof quoteSummarySchema>;
export type QuoteQuery = z.infer<typeof quoteQuerySchema>;
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;
