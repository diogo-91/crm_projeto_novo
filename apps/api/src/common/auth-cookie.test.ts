import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { parseApiEnvironment } from '@crm/config/server';
import { refreshCookieName, refreshCookieOptions } from './auth-cookie.js';
it('production uses a __Host cookie name and development remains local', () => {
  const input = {
    NODE_ENV: 'production',
    API_PORT: 3001,
    DATABASE_URL: 'postgresql://synthetic@localhost/test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    CORS_ORIGINS: 'https://crm.example.test',
    JWT_SECRET: randomBytes(32).toString('base64url'),
  };
  expect(refreshCookieName(parseApiEnvironment(input))).toBe('__Host-crm-refresh');
  expect(refreshCookieOptions(parseApiEnvironment(input))).toEqual({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  expect(refreshCookieName(parseApiEnvironment({ ...input, NODE_ENV: 'test' }))).toBe(
    'crm_refresh',
  );
});
