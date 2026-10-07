import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  normalizePhone,
  normalizeDocument,
  normalizeTagName,
  createContactSchema,
  createCompanySchema,
  createTagSchema,
  contactListQuerySchema,
  updateContactSchema,
} from './commercial.js';
describe('commercial normalization and strict contracts', () => {
  it.each([
    [' +44 (20) 1234-5678 ', '+442012345678'],
    ['(11) 91234-5678', '11912345678'],
  ])('normalizes phone %s without inventing DDI', (input, output) =>
    expect(normalizePhone(input)).toBe(output),
  );
  it('normalizes documents without jurisdiction assumptions', () =>
    expect(normalizeDocument(' gb-123.4/5 ')).toBe('GB12345'));
  it('normalizes tag whitespace and case', () =>
    expect(normalizeTagName('  Cliente   VIP ')).toBe('cliente vip'));
  it('normalizes contact email and preserves display phone', () => {
    expect(
      createContactSchema.parse({
        name: ' Client ',
        phone: '+44 (20) 1234-5678',
        email: ' CLIENT@EXAMPLE.TEST ',
        branchId: randomUUID(),
      }).email,
    ).toBe('client@example.test');
  });
  it.each(['123', '++5511999999999', '(11) hello', '55119999999999999'])(
    'rejects invalid phone %s',
    (phone) =>
      expect(
        createContactSchema.safeParse({ name: 'Client', phone, branchId: randomUUID() }).success,
      ).toBe(false),
  );
  it('rejects tenant and internal mass assignment', () =>
    expect(
      createContactSchema.safeParse({
        name: 'Client',
        phone: '123456789',
        branchId: randomUUID(),
        organizationId: randomUUID(),
        active: false,
      }).success,
    ).toBe(false));
  it('allows optional company contact details', () =>
    expect(createCompanySchema.safeParse({ name: 'Company', branchId: randomUUID() }).success).toBe(
      true,
    ));
  it('requires version for patch', () =>
    expect(updateContactSchema.safeParse({ name: 'Changed' }).success).toBe(false));
  it('bounds pagination and sorting whitelist', () => {
    expect(contactListQuerySchema.safeParse({ limit: '100000' }).success).toBe(false);
    expect(contactListQuerySchema.safeParse({ sort: 'passwordHash' }).success).toBe(false);
  });
  it('rejects arbitrary CSS for tag', () =>
    expect(
      createTagSchema.safeParse({ name: 'Tag', variant: 'url(javascript:evil)' }).success,
    ).toBe(false));
  it('rejects duplicated tags', () => {
    const id = randomUUID();
    expect(
      createContactSchema.safeParse({
        name: 'Client',
        phone: '123456789',
        branchId: randomUUID(),
        tagIds: [id, id],
      }).success,
    ).toBe(false);
  });
});

it('PATCH does not apply creation defaults to omitted relationships or source', () => {
  const patch = updateContactSchema.parse({ name: 'Edited', expectedVersion: 1 });
  expect(patch).not.toHaveProperty('tagIds');
  expect(patch).not.toHaveProperty('source');
});
