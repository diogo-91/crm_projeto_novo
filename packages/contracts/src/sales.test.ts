import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createLeadSchema,
  updateLeadSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  createPipelineSchema,
  conversionSchema,
  reorderStagesSchema,
  amountSchema,
  moveOpportunitySchema,
} from './sales.js';
const assignment = { name: ' Test ', branchId: randomUUID() };
it('normalizes lead email and trims names without assigning a status from the caller', () => {
  expect(createLeadSchema.parse({ ...assignment, email: ' SALES@EXAMPLE.TEST ' })).toMatchObject({
    name: 'Test',
    email: 'sales@example.test',
    source: 'MANUAL',
  });
  expect(createLeadSchema.safeParse({ ...assignment, status: 'CONVERTED' }).success).toBe(false);
});
it.each(['organizationId', 'active', 'version', 'createdByMembershipId', 'conversionRequestHash'])(
  'rejects sensitive field %s',
  (field) =>
    expect(createLeadSchema.safeParse({ ...assignment, [field]: 'injected' }).success).toBe(false),
);
it('requires conversion as the only path to CONVERTED', () =>
  expect(updateLeadSchema.safeParse({ expectedVersion: 1, status: 'CONVERTED' }).success).toBe(
    false,
  ));
it('patches preserve omitted defaults and associations', () => {
  expect(updateLeadSchema.parse({ expectedVersion: 1, notes: 'Updated' })).toEqual({
    expectedVersion: 1,
    notes: 'Updated',
  });
  expect(updateOpportunitySchema.parse({ expectedVersion: 1, notes: 'Updated' })).toEqual({
    expectedVersion: 1,
    notes: 'Updated',
  });
});
it.each(['0', '123.4567', '999999999999999.9999'])('accepts exact decimal string %s', (value) =>
  expect(amountSchema.safeParse(value).success).toBe(true),
);
it.each(['-1', '1e3', '1,23', '1.12345', '1000000000000000', 1])(
  'rejects invalid monetary value %s',
  (value) => expect(amountSchema.safeParse(value).success).toBe(false),
);
it('creation requires pipeline and stage and rejects a forged result', () => {
  const input = { ...assignment, pipelineId: randomUUID(), stageId: randomUUID() };
  expect(createOpportunitySchema.parse(input)).toMatchObject({ amount: '0', currency: 'BRL' });
  expect(createOpportunitySchema.safeParse({ ...input, status: 'WON' }).success).toBe(false);
  expect(
    updateOpportunitySchema.safeParse({ expectedVersion: 1, pipelineId: randomUUID() }).success,
  ).toBe(false);
});
it('pipelines must start with an open stage', () =>
  expect(
    createPipelineSchema.safeParse({ name: 'Sales', stages: [{ name: 'Won', kind: 'WON' }] })
      .success,
  ).toBe(false));
it('conversion cannot create and select the same relationship', () =>
  expect(
    conversionSchema.safeParse({
      pipelineId: randomUUID(),
      stageId: randomUUID(),
      expectedVersion: 1,
      createContact: true,
      contactId: randomUUID(),
    }).success,
  ).toBe(false));
it('reorder rejects duplicated stages', () => {
  const id = randomUUID();
  expect(reorderStagesSchema.safeParse({ expectedVersion: 1, stageIds: [id, id] }).success).toBe(
    false,
  );
});
it('stage movement requires positive expected version and rejects unknown fields', () =>
  expect(
    moveOpportunitySchema.safeParse({ stageId: randomUUID(), expectedVersion: 0, status: 'WON' })
      .success,
  ).toBe(false));
