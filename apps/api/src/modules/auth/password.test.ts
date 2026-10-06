import { beforeAll, expect, it } from 'vitest';
import { PasswordService } from './password.module.js';
const passwords = new PasswordService();
beforeAll(() => passwords.onModuleInit());
it('uses Argon2id with random salt and defined memory/time/parallelism parameters', async () => {
  const one = await passwords.hash('Synthetic Password 2026!');
  const two = await passwords.hash('Synthetic Password 2026!');
  const parts = one.split('$');
  expect(parts[1]).toBe('argon2id');
  expect(parts[2]).toBe('v=19');
  expect(parts[3]?.split(',').sort()).toEqual(['m=65536', 'p=1', 't=3']);
  expect(one).not.toBe(two);
  expect(await passwords.verify('Synthetic Password 2026!', one)).toBe(true);
  expect(await passwords.verify('wrong', one)).toBe(false);
});
it('missing credential performs verification but cannot authenticate', async () => {
  expect(await passwords.verify('anything', null)).toBe(false);
});
it('malformed persisted hashes propagate an error rather than hiding corruption', async () => {
  await expect(passwords.verify('password', '$argon2id$invalid')).rejects.toThrow();
});
