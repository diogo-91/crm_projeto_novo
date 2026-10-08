import { z } from 'zod';
import { uuidSchema, listQuerySchema } from './organizations.js';
import { commercialListQuerySchema } from './commercial.js';
import { currencySchema, unitPriceSchema } from './money.js';
const name = z.string().trim().min(1, 'Informe o nome.').max(160);
export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_.-]{0,63}$/, 'Use letras, números, ponto, hífen ou underscore no SKU.');
export const createProductSchema = z
  .object({
    name,
    sku: skuSchema,
    unit: z.string().trim().min(1).max(32),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
export const updateProductSchema = createProductSchema
  .omit({ unit: true })
  .partial()
  .extend({ expectedVersion: z.number().int().min(1) })
  .strict();
export const createPriceListSchema = z
  .object({ name, currency: currencySchema, branchId: uuidSchema.nullable().optional() })
  .strict();
export const updatePriceListSchema = z
  .object({ name: name.optional(), expectedVersion: z.number().int().min(1) })
  .strict();
export const setPriceSchema = z
  .object({ unitPrice: unitPriceSchema, expectedVersion: z.number().int().min(1) })
  .strict();
export const productListQuerySchema = commercialListQuerySchema
  .omit({ branchId: true, ownerMembershipId: true })
  .extend({ cursor: z.string().max(768).optional() })
  .strict();
export const priceListQuerySchema = productListQuerySchema
  .extend({ branchId: uuidSchema.optional() })
  .strict();
export const priceItemQuerySchema = listQuerySchema
  .extend({ active: z.enum(['true', 'false']).optional() })
  .strict();
const state = {
  active: z.boolean(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};
export const productResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    sku: z.string(),
    unit: z.string(),
    description: z.string().nullable(),
    ...state,
  })
  .strict();
export const priceListResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    currency: currencySchema,
    canManage: z.boolean(),
    branch: z.object({ id: uuidSchema, name: z.string() }).strict().nullable(),
    ...state,
  })
  .strict();
export const priceItemResponseSchema = z
  .object({
    id: uuidSchema,
    product: z
      .object({
        id: uuidSchema,
        name: z.string(),
        sku: z.string(),
        unit: z.string(),
        active: z.boolean(),
      })
      .strict(),
    unitPrice: unitPriceSchema,
    active: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
const pageInfo = z.object({ hasNextPage: z.boolean(), nextCursor: z.string().nullable() }).strict();
export const productListResponseSchema = z
  .object({ data: z.array(productResponseSchema), pageInfo })
  .strict();
export const priceListListResponseSchema = z
  .object({ data: z.array(priceListResponseSchema), pageInfo })
  .strict();
export const priceItemListResponseSchema = z
  .object({ data: z.array(priceItemResponseSchema), pageInfo })
  .strict();
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type CreatePriceList = z.infer<typeof createPriceListSchema>;
export type UpdatePriceList = z.infer<typeof updatePriceListSchema>;
export type SetPrice = z.infer<typeof setPriceSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type PriceListQuery = z.infer<typeof priceListQuerySchema>;
export type PriceItemQuery = z.infer<typeof priceItemQuerySchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type PriceListResponse = z.infer<typeof priceListResponseSchema>;
export type PriceItemResponse = z.infer<typeof priceItemResponseSchema>;

export const priceBranchOptionsSchema = z
  .object({
    data: z.array(z.object({ id: uuidSchema, name: z.string() }).strict()),
    pageInfo,
    organizationAllowed: z.boolean(),
  })
  .strict();
