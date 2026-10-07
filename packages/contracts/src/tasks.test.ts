import { expect, it } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  createActivitySchema,
  taskListQuerySchema,
  reminderJobSchema,
} from './tasks.js';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
it('task defaults and strict mapping reject internal ownership and status fields', () => {
  const input = { name: '  Follow-up  ', branchId: id };
  expect(createTaskSchema.parse(input)).toMatchObject({
    name: 'Follow-up',
    kind: 'TASK',
    priority: 'NORMAL',
  });
  for (const fields of [{ organizationId: id }, { status: 'COMPLETED' }, { reminderVersion: 3 }])
    expect(createTaskSchema.safeParse({ ...input, ...fields }).success).toBe(false);
});
it('reminders require a due instant and preserve explicit timezone offsets', () => {
  const input = { name: 'Call', branchId: id, dueAt: '2026-10-07T12:00:00-03:00' };
  expect(createTaskSchema.safeParse({ ...input, remindAt: '2026-10-07T14:00:00Z' }).success).toBe(
    true,
  );
  for (const dates of [
    { dueAt: null, remindAt: input.dueAt },
    { remindAt: '2026-10-07T16:00:00Z' },
    { dueAt: '2026-10-07T12:00' },
  ])
    expect(createTaskSchema.safeParse({ ...input, ...dates }).success).toBe(false);
});
it('partial task updates carry a version without silently clearing omitted dates or links', () => {
  expect(updateTaskSchema.parse({ expectedVersion: 2, name: 'New' })).toEqual({
    expectedVersion: 2,
    name: 'New',
  });
  expect(updateTaskSchema.safeParse({ name: 'No version' }).success).toBe(false);
});
it('timeline interactions accept exactly one implemented target and meaningful content', () => {
  expect(
    createActivitySchema.parse({ target: { type: 'lead', id }, description: '  Called  ' }),
  ).toMatchObject({ kind: 'NOTE', description: 'Called' });
  for (const input of [
    { description: 'No target' },
    { target: { type: 'quote', id }, description: 'No quote' },
    { target: { type: 'contact', id }, description: '  ' },
    { target: { type: 'contact', id }, description: 'Text', actorMembershipId: id },
  ])
    expect(createActivitySchema.safeParse(input).success).toBe(false);
});
it('task filters require a complete target pair and an ordered interval', () => {
  expect(taskListQuerySchema.safeParse({ targetId: id }).success).toBe(false);
  expect(
    taskListQuerySchema.safeParse({ from: '2026-10-08T00:00:00Z', until: '2026-10-07T00:00:00Z' })
      .success,
  ).toBe(false);
  expect(
    taskListQuerySchema.safeParse({ targetType: 'contact', targetId: id, limit: '25' }).success,
  ).toBe(true);
});
it('reminder jobs carry only a version and opaque durable intent ID', () => {
  expect(reminderJobSchema.parse({ version: 1, reminderId: id })).toEqual({
    version: 1,
    reminderId: id,
  });
  expect(reminderJobSchema.safeParse({ version: 1, reminderId: id, token: 'secret' }).success).toBe(
    false,
  );
});
