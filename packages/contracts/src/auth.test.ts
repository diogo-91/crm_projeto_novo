import { expect, it } from 'vitest';
import { loginSchema, changePasswordSchema, selectContextSchema } from './auth.js';
import { assignRoleSchema } from './access-control.js';
import { newPasswordSchema } from './identity.js';
it('normalizes email without trimming or truncating passwords', () => {
  expect(loginSchema.parse({ email: ' USER@EXAMPLE.TEST ', password: ' with spaces ' })).toEqual({
    email: 'user@example.test',
    password: ' with spaces ',
  });
});
it('enforces new password length without rejecting passphrases or Unicode', () => {
  expect(newPasswordSchema.safeParse('short').success).toBe(false);
  expect(newPasswordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  expect(newPasswordSchema.parse('frase longa segura com espaços')).toBe(
    'frase longa segura com espaços',
  );
});
it('rejects identity/role mass assignment and unsupported tenant scope', () => {
  expect(
    loginSchema.safeParse({ email: 'user@example.test', password: 'password', active: true })
      .success,
  ).toBe(false);
  expect(
    assignRoleSchema.safeParse({ roleId: '9b150a17-f00e-4f2c-8730-513ff1fc9801', scope: 'ALL' })
      .success,
  ).toBe(false);
  expect(selectContextSchema.safeParse({ organizationId: 'not-a-uuid' }).success).toBe(false);
  expect(
    changePasswordSchema.safeParse({
      currentPassword: 'password',
      newPassword: 'long password',
      securityVersion: 1,
    }).success,
  ).toBe(false);
});
