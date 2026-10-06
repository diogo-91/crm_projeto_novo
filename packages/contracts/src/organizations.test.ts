import { expect, it } from 'vitest';
import {
  createOrganizationSchema,
  createBranchSchema,
  createOrganizationUserSchema,
  createMembershipSchema,
  listQuerySchema,
} from './organizations.js';
it('normalizes global email and names on the server contract', () => {
  expect(
    createOrganizationUserSchema.parse({ name: ' Ana ', email: ' Ana@EXAMPLE.TEST ' }),
  ).toEqual({ name: 'Ana', email: 'ana@example.test', branchIds: [] });
});
it('normalizes configurable branch codes and optional international documents', () => {
  expect(createBranchSchema.parse({ name: ' Loja ', code: ' loja_1 ' })).toEqual({
    name: 'Loja',
    code: 'LOJA_1',
  });
  expect(
    createOrganizationSchema.parse({ name: ' Org ', document: ' gb-123.456/789 ' }).document,
  ).toBe('GB123456789');
});
it.each([
  { name: '', email: 'user@example.test' },
  { name: 'User', email: 'invalid' },
  { name: 'User', email: 'user@example.test', passwordHash: 'hidden' },
  { name: 'User', email: 'user@example.test', active: false },
])('rejects invalid identity input and mass assignment: %j', (input) => {
  expect(createOrganizationUserSchema.safeParse(input).success).toBe(false);
});
it('validates UUIDs, branch codes and nonempty documents', () => {
  expect(createMembershipSchema.safeParse({ userId: 'invalid' }).success).toBe(false);
  expect(createBranchSchema.safeParse({ name: 'Loja', code: 'A B' }).success).toBe(false);
  expect(createOrganizationSchema.safeParse({ name: 'Org', document: './-' }).success).toBe(false);
});
it('bounds pagination and rejects unknown filters', () => {
  expect(listQuerySchema.parse({ limit: '2' })).toEqual({ limit: 2 });
  expect(listQuerySchema.parse({})).toEqual({ limit: 25 });
  expect(listQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  expect(listQuerySchema.safeParse({ organizationId: 'other' }).success).toBe(false);
});
