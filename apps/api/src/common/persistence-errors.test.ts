import { expect, it } from 'vitest';
import { Prisma } from '@crm/database';
import { ApplicationError } from './application-error.js';
import { persist } from './persistence-errors.js';
it.each([
  ['P2002', 'RESOURCE_CONFLICT'],
  ['P2003', 'RESOURCE_NOT_FOUND'],
  ['P2025', 'RESOURCE_NOT_FOUND'],
  ['P2000', 'INVALID_INPUT'],
  ['P2004', 'INVALID_INPUT'],
])('maps known persistence error %s without leaking database details', async (code, expected) => {
  const original = new Prisma.PrismaClientKnownRequestError('private database details', {
    code,
    clientVersion: '7.10.0',
  });
  try {
    await persist(() => Promise.reject(original));
    throw new Error('Expected failure');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toHaveProperty('code', expected);
    expect(error instanceof Error ? error.message : '').not.toContain('private database details');
  }
});
it('propagates unknown infrastructure failure rather than treating it as a successful operation', async () => {
  const error = new Error('Infrastructure unavailable');
  await expect(persist(() => Promise.reject(error))).rejects.toBe(error);
});
it('preserves application policy errors', async () => {
  const error = new ApplicationError('USER_INACTIVE', 'Inactive user');
  await expect(persist(() => Promise.reject(error))).rejects.toBe(error);
});
it('returns successful persistence results', async () => {
  await expect(persist(() => Promise.resolve('created'))).resolves.toBe('created');
});
