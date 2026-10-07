import { z } from 'zod';
import { uuidSchema, listQuerySchema } from './organizations.js';
import { emailSchema } from './identity.js';
import { phoneSchema, commercialListQuerySchema, contactSourceSchema } from './commercial.js';
const named = z.object({ id: uuidSchema, name: z.string() }).strict();
const name = z.string().trim().min(1, 'Informe o nome.').max(160);
const optionalText = z.string().trim().max(4000).nullable().optional();
const version = z.number().int().min(1);
const timestamps = { createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), version };
export const leadStatusSchema = z.enum(['NEW', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED']);
export const dealStatusSchema = z.enum(['OPEN', 'WON', 'LOST']);
export const currencySchema = z.enum(['BRL', 'USD', 'EUR', 'GBP']);
export const amountSchema = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Informe valor positivo com até quatro casas decimais.');
const assignment = {
  name,
  branchId: uuidSchema,
  ownerMembershipId: uuidSchema.optional(),
  notes: optionalText,
  contactId: uuidSchema.nullable().optional(),
  companyId: uuidSchema.nullable().optional(),
};
export const createLeadSchema = z
  .object({
    ...assignment,
    phone: phoneSchema.nullable().optional(),
    email: emailSchema.nullable().optional(),
    companyName: name.nullable().optional(),
    source: contactSourceSchema.default('MANUAL'),
  })
  .strict();
export const updateLeadSchema = createLeadSchema
  .omit({ source: true })
  .partial()
  .extend({
    source: contactSourceSchema.optional(),
    status: leadStatusSchema.exclude(['CONVERTED']).optional(),
    expectedVersion: version,
  })
  .strict();
export const createOpportunitySchema = z
  .object({
    ...assignment,
    pipelineId: uuidSchema,
    stageId: uuidSchema,
    amount: amountSchema.default('0'),
    currency: currencySchema.default('BRL'),
  })
  .strict();
export const updateOpportunitySchema = createOpportunitySchema
  .omit({ pipelineId: true, stageId: true, amount: true, currency: true })
  .partial()
  .extend({
    amount: amountSchema.optional(),
    currency: currencySchema.optional(),
    expectedVersion: version,
  })
  .strict();
export const moveOpportunitySchema = z
  .object({
    stageId: uuidSchema,
    expectedVersion: version,
    reason: z.string().trim().min(1, 'Informe o motivo da perda.').max(500).optional(),
  })
  .strict();
export const conversionSchema = z
  .object({
    pipelineId: uuidSchema,
    stageId: uuidSchema,
    expectedVersion: version,
    opportunityName: name.optional(),
    amount: amountSchema.default('0'),
    currency: currencySchema.default('BRL'),
    contactId: uuidSchema.nullable().optional(),
    companyId: uuidSchema.nullable().optional(),
    createContact: z.boolean().default(false),
    createCompany: z.boolean().default(false),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.createContact && input.contactId)
      ctx.addIssue({
        code: 'custom',
        path: ['contactId'],
        message: 'Selecione ou crie o cliente.',
      });
    if (input.createCompany && input.companyId)
      ctx.addIssue({
        code: 'custom',
        path: ['companyId'],
        message: 'Selecione ou crie a empresa.',
      });
  });
export const stageInputSchema = z.object({ name, kind: dealStatusSchema.default('OPEN') }).strict();
export const createPipelineSchema = z
  .object({
    name,
    branchId: uuidSchema.nullable().optional(),
    stages: z
      .array(stageInputSchema)
      .min(1)
      .max(30)
      .refine(
        (stages) => stages.some((stage) => stage.kind === 'OPEN'),
        'Inclua ao menos uma etapa aberta.',
      ),
  })
  .strict();
export const updatePipelineSchema = z
  .object({ name: name.optional(), expectedVersion: version })
  .strict();
export const addStageSchema = stageInputSchema.extend({ expectedVersion: version }).strict();
export const updateStageSchema = z
  .object({ name: name.optional(), active: z.boolean().optional(), expectedVersion: version })
  .strict();
export const reorderStagesSchema = z
  .object({
    expectedVersion: version,
    stageIds: z
      .array(uuidSchema)
      .min(1)
      .max(30)
      .refine((ids) => new Set(ids).size === ids.length, 'Etapas repetidas.'),
  })
  .strict();
export const stageResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    kind: dealStatusSchema,
    position: z.number().int(),
    active: z.boolean(),
  })
  .strict();
export const pipelineResponseSchema = z
  .object({
    ...timestamps,
    id: uuidSchema,
    name: z.string(),
    branch: named.nullable(),
    active: z.boolean(),
    stages: z.array(stageResponseSchema),
  })
  .strict();
const pageInfo = z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict();
export const pipelineListResponseSchema = z
  .object({ data: z.array(pipelineResponseSchema), pageInfo })
  .strict();
export const pipelineListQuerySchema = listQuerySchema
  .extend({
    search: z.string().trim().max(160).optional(),
    branchId: uuidSchema.optional(),
    active: z.enum(['true', 'false']).optional(),
  })
  .strict();
const response = {
  ...timestamps,
  id: uuidSchema,
  name: z.string(),
  notes: z.string().nullable(),
  active: z.boolean(),
  branch: named,
  owner: named,
  contact: named.nullable(),
  company: named.nullable(),
};
export const leadResponseSchema = z
  .object({
    ...response,
    phone: z.string().nullable(),
    email: z.string().nullable(),
    companyName: z.string().nullable(),
    source: contactSourceSchema,
    status: leadStatusSchema,
    convertedAt: z.iso.datetime().nullable(),
    opportunity: named.nullable(),
  })
  .strict();
export const opportunityResponseSchema = z
  .object({
    ...response,
    pipeline: named,
    stage: stageResponseSchema,
    status: dealStatusSchema,
    amount: amountSchema,
    currency: currencySchema,
    closedAt: z.iso.datetime().nullable(),
    lostReason: z.string().nullable(),
  })
  .strict();
export const leadListResponseSchema = z
  .object({ data: z.array(leadResponseSchema), pageInfo })
  .strict();
export const opportunityListResponseSchema = z
  .object({ data: z.array(opportunityResponseSchema), pageInfo })
  .strict();
const commercialQuery = commercialListQuerySchema.extend({
  cursor: z.string().max(768).optional(),
});
export const leadListQuerySchema = commercialQuery
  .extend({ status: leadStatusSchema.optional(), source: contactSourceSchema.optional() })
  .strict();
export const opportunityListQuerySchema = commercialQuery
  .extend({
    pipelineId: uuidSchema.optional(),
    stageId: uuidSchema.optional(),
    status: dealStatusSchema.optional(),
    contactId: uuidSchema.optional(),
    companyId: uuidSchema.optional(),
  })
  .strict();
export const conversionResponseSchema = z
  .object({ lead: leadResponseSchema, opportunity: opportunityResponseSchema })
  .strict();
export const stageHistoryResponseSchema = z
  .object({
    id: uuidSchema,
    from: z
      .object({
        pipelineId: uuidSchema,
        stageId: uuidSchema,
        name: z.string(),
        status: dealStatusSchema,
      })
      .strict()
      .nullable(),
    to: z
      .object({
        pipelineId: uuidSchema,
        stageId: uuidSchema,
        name: z.string(),
        status: dealStatusSchema,
      })
      .strict(),
    reason: z.string().nullable(),
    recordVersion: version,
    occurredAt: z.iso.datetime(),
  })
  .strict();
export const stageHistoryListResponseSchema = z
  .object({ data: z.array(stageHistoryResponseSchema), pageInfo })
  .strict();
export type CreateLead = z.output<typeof createLeadSchema>;
export type UpdateLead = z.output<typeof updateLeadSchema>;
export type LeadListQuery = z.output<typeof leadListQuerySchema>;
export type LeadResponse = z.output<typeof leadResponseSchema>;
export type CreateOpportunity = z.output<typeof createOpportunitySchema>;
export type UpdateOpportunity = z.output<typeof updateOpportunitySchema>;
export type OpportunityListQuery = z.output<typeof opportunityListQuerySchema>;
export type OpportunityResponse = z.output<typeof opportunityResponseSchema>;
export type MoveOpportunity = z.output<typeof moveOpportunitySchema>;
export type ConvertLead = z.output<typeof conversionSchema>;
export type ConversionResponse = z.output<typeof conversionResponseSchema>;
export type CreatePipeline = z.output<typeof createPipelineSchema>;
export type UpdatePipeline = z.output<typeof updatePipelineSchema>;
export type AddStage = z.output<typeof addStageSchema>;
export type UpdateStage = z.output<typeof updateStageSchema>;
export type ReorderStages = z.output<typeof reorderStagesSchema>;
export type PipelineListQuery = z.output<typeof pipelineListQuerySchema>;
export type PipelineResponse = z.output<typeof pipelineResponseSchema>;
export type StageResponse = z.output<typeof stageResponseSchema>;
export type StageHistoryListResponse = z.output<typeof stageHistoryListResponseSchema>;
export type OpportunityListResponse = z.output<typeof opportunityListResponseSchema>;
