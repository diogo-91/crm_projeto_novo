import { z } from 'zod';
import { expect, it } from 'vitest';
import {
  createOrganizationUserSchema,
  membershipResponseSchema,
  listQuerySchema,
} from '@crm/contracts';
import { openApiSchema } from './openapi-schema.js';
it('generates strict request documentation from the validation contract', () => {
  const schema = openApiSchema(createOrganizationUserSchema, 'input');
  expect(schema.additionalProperties).toBe(false);
  expect(schema.required).toEqual(['name', 'email']);
  expect(schema.properties).toHaveProperty('branchIds.maxItems', 100);
  expect(schema.properties).toHaveProperty('email.format', 'email');
  expect(schema.properties).not.toHaveProperty('passwordHash');
  expect(openApiSchema(listQuerySchema.shape.limit)).toMatchObject({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 25,
  });
});
it('documents nullable primary branch and safe identity response', () => {
  const schema = openApiSchema(membershipResponseSchema);
  expect(schema.properties).toHaveProperty('primaryBranchId.nullable', true);
  expect(schema.properties).toHaveProperty('user.properties.email.format', 'email');
  expect(schema.properties).not.toHaveProperty('user.properties.passwordHash');
});

it('preserves exclusive numeric bounds in OpenAPI 3 instead of weakening validation', () => {
  expect(openApiSchema(z.number().gt(0).lt(10))).toMatchObject({
    minimum: 0,
    exclusiveMinimum: true,
    maximum: 10,
    exclusiveMaximum: true,
  });
});
