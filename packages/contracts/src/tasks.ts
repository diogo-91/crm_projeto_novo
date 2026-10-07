import { z } from 'zod';
import { uuidSchema, listQuerySchema } from './organizations.js';
import { commercialListQuerySchema } from './commercial.js';
export const taskKindSchema = z.enum(['TASK', 'FOLLOW_UP']);
export const taskPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);
export const taskStatusSchema = z.enum(['OPEN', 'COMPLETED']);
export const taskEventKindSchema = z.enum([
  'CREATED',
  'UPDATED',
  'COMPLETED',
  'REOPENED',
  'ARCHIVED',
]);
export const activityKindSchema = z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING']);
export const targetTypeSchema = z.enum(['contact', 'lead', 'opportunity']);
export const resourceTargetSchema = z.object({ type: targetTypeSchema, id: uuidSchema }).strict();
const instant = z.iso.datetime({ offset: true });
const name = z.string().trim().min(1, 'Informe o título.').max(160);
const fields = {
  name,
  description: z.string().trim().max(4000).nullable().optional(),
  branchId: uuidSchema,
  ownerMembershipId: uuidSchema.optional(),
  dueAt: instant.nullable().optional(),
  remindAt: instant.nullable().optional(),
  target: resourceTargetSchema.nullable().optional(),
};
export function validReminderDates(value: {
  dueAt?: string | null | undefined;
  remindAt?: string | null | undefined;
}) {
  return (
    !value.remindAt || Boolean(value.dueAt && Date.parse(value.remindAt) <= Date.parse(value.dueAt))
  );
}
export const createTaskSchema = z
  .object({
    ...fields,
    kind: taskKindSchema.default('TASK'),
    priority: taskPrioritySchema.default('NORMAL'),
  })
  .strict()
  .refine(validReminderDates, {
    message: 'O lembrete exige vencimento e deve ocorrer até ele.',
    path: ['remindAt'],
  });
export const updateTaskSchema = z
  .object({ ...fields, kind: taskKindSchema, priority: taskPrioritySchema })
  .partial()
  .extend({ expectedVersion: z.number().int().min(1) })
  .strict();
export const taskListQuerySchema = commercialListQuerySchema
  .extend({
    cursor: z.string().max(768).optional(),
    status: taskStatusSchema.optional(),
    kind: taskKindSchema.optional(),
    priority: taskPrioritySchema.optional(),
  })
  .extend({
    due: z.enum(['overdue', 'today', 'upcoming']).optional(),
    from: instant.optional(),
    until: instant.optional(),
    targetType: targetTypeSchema.optional(),
    targetId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => Boolean(v.targetType) === Boolean(v.targetId), 'Informe tipo e ID do alvo juntos.')
  .refine(
    (v) => !v.from || !v.until || Date.parse(v.from) <= Date.parse(v.until),
    'Intervalo inválido.',
  );
const named = z.object({ id: uuidSchema, name: z.string() }).strict();
export const taskResponseSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    description: z.string().nullable(),
    branch: named,
    owner: named,
    kind: taskKindSchema,
    priority: taskPrioritySchema,
    status: taskStatusSchema,
    dueAt: instant.nullable(),
    remindAt: instant.nullable(),
    completedAt: instant.nullable(),
    target: resourceTargetSchema.nullable(),
    active: z.boolean(),
    version: z.number().int().positive(),
    createdAt: instant,
    updatedAt: instant,
  })
  .strict();
const pageInfo = z.object({ nextCursor: z.string().nullable(), hasNextPage: z.boolean() }).strict();
export const taskListResponseSchema = z
  .object({ data: z.array(taskResponseSchema), pageInfo })
  .strict();
export const createActivitySchema = z
  .object({
    target: resourceTargetSchema,
    kind: activityKindSchema.default('NOTE'),
    description: z.string().trim().min(1, 'Descreva a interação.').max(4000),
  })
  .strict();
export const activityResponseSchema = z
  .object({
    id: uuidSchema,
    target: resourceTargetSchema,
    kind: activityKindSchema,
    description: z.string(),
    createdAt: instant,
  })
  .strict();
export const timelineQuerySchema = listQuerySchema
  .extend({ cursor: z.string().max(768).optional() })
  .strict();
export const timelineEntrySchema = z
  .object({
    id: uuidSchema,
    type: z.enum(['ACTIVITY', 'TASK', 'STAGE']),
    name: z.string(),
    description: z.string().nullable(),
    taskId: uuidSchema.nullable(),
    createdAt: instant,
    updatedAt: instant,
  })
  .strict();
export const timelineResponseSchema = z
  .object({ data: z.array(timelineEntrySchema), pageInfo })
  .strict();
export const notificationQuerySchema = timelineQuerySchema
  .extend({ unread: z.enum(['true', 'false']).optional() })
  .strict();
export const notificationResponseSchema = z
  .object({ id: uuidSchema, task: named, readAt: instant.nullable(), createdAt: instant })
  .strict();
export const notificationListResponseSchema = z
  .object({ data: z.array(notificationResponseSchema), pageInfo })
  .strict();
export const reminderJobSchema = z
  .object({ version: z.literal(1), reminderId: uuidSchema })
  .strict();
export type ResourceTarget = z.infer<typeof resourceTargetSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
export type CreateActivity = z.infer<typeof createActivitySchema>;
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type ReminderJob = z.infer<typeof reminderJobSchema>;

export const reminderStatusSchema = z
  .object({
    id: uuidSchema,
    state: z.enum(['PENDING', 'DISPATCHED', 'COMPLETED', 'CANCELED', 'FAILED']),
    attemptCount: z.number().int().nonnegative(),
    lastErrorCode: z.string().nullable(),
    availableAt: instant,
  })
  .strict()
  .nullable();
export const retryReminderResponseSchema = z.object({ accepted: z.literal(true) }).strict();

export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
