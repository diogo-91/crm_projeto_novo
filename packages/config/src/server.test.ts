import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseApiEnvironment, parseDatabaseEnvironment, parseWorkerEnvironment } from './server.js';
const valid = {
  NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('base64url'),
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  API_PORT: '3001',
  DATABASE_URL: 'postgresql://test:synthetic@localhost/crm',
  CORS_ORIGINS: 'http://localhost:3000',
};
describe('server environment', () => {
  it('parses typed ports and role', () => {
    const config = parseApiEnvironment(valid);
    expect(config.API_PORT).toBe(3001);
    expect(config.role).toBe('api');
  });
  it.each(['DATABASE_URL', 'REDIS_HOST', 'REDIS_PORT', 'NODE_ENV', 'API_PORT', 'CORS_ORIGINS'])(
    'rejects missing %s',
    (field) => {
      const input: Record<string, unknown> = { ...valid };
      delete input[field];
      expect(() => parseApiEnvironment(input)).toThrow(field);
    },
  );
  it.each(['0', '65536', 'abc'])('rejects invalid port %s', (value) =>
    expect(() => parseApiEnvironment({ ...valid, API_PORT: value })).toThrow('API_PORT'),
  );
  it.each(['*', 'https://example.com/path', 'https://example.com/'])(
    'rejects invalid CORS origin %s',
    (value) =>
      expect(() => parseApiEnvironment({ ...valid, CORS_ORIGINS: value })).toThrow('CORS_ORIGINS'),
  );
  it('does not disclose bad secret configuration', () =>
    expect(() =>
      parseApiEnvironment({ ...valid, DATABASE_URL: 'private-sensitive-value' }),
    ).toThrow(/^Invalid environment configuration: DATABASE_URL$/));
  it('worker requires database for durable reminders but no API signing secret', () =>
    expect(
      parseWorkerEnvironment({
        NODE_ENV: 'test',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        DATABASE_URL: valid.DATABASE_URL,
      }).role,
    ).toBe('worker'));
  it('rejects a non-PostgreSQL URL', () =>
    expect(() => parseDatabaseEnvironment({ DATABASE_URL: 'https://example.com' })).toThrow(
      'DATABASE_URL',
    ));
});

it.each(['', 'default-secret', 'a'.repeat(43)])(
  'rejects empty, predictable or malformed JWT secret',
  (secret) => {
    expect(() => parseApiEnvironment({ ...valid, JWT_SECRET: secret })).toThrow('JWT_SECRET');
  },
);
it('requires JWT only for API and bounds token/session lifetime', () => {
  expect(() => parseApiEnvironment({ ...valid, ACCESS_TOKEN_TTL_SECONDS: 3600 })).toThrow(
    'ACCESS_TOKEN_TTL_SECONDS',
  );
  expect(() => parseApiEnvironment({ ...valid, SESSION_TTL_SECONDS: 31536000 })).toThrow(
    'SESSION_TTL_SECONDS',
  );
});

it('requires the API signing secret', () => {
  const input: Record<string, unknown> = { ...valid };
  delete input['JWT_SECRET'];
  expect(() => parseApiEnvironment(input)).toThrow('JWT_SECRET');
});

it('worker fails startup without the database required by durable reminders', () => {
  expect(() =>
    parseWorkerEnvironment({ NODE_ENV: 'test', REDIS_HOST: 'localhost', REDIS_PORT: '6379' }),
  ).toThrow('DATABASE_URL');
});
