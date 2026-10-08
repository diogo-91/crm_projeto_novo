import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  parseApiEnvironment,
  parseDatabaseEnvironment,
  parseWorkerEnvironment,
  parseInitialSetupEnvironment,
  parseSeedEnvironment,
} from './server.js';
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

it('keeps local binding and no trusted proxy by default', () => {
  const config = parseApiEnvironment(valid);
  expect(config.API_HOST).toBe('127.0.0.1');
  expect(config.TRUST_PROXY_CIDRS).toEqual([]);
});
it('accepts container binding and explicit IPv4/IPv6 trusted peers', () => {
  const config = parseApiEnvironment({
    ...valid,
    API_HOST: '0.0.0.0',
    TRUST_PROXY_CIDRS: '172.20.0.2/32, fd00::2/128',
  });
  expect(config.API_HOST).toBe('0.0.0.0');
  expect(config.TRUST_PROXY_CIDRS).toEqual(['172.20.0.2/32', 'fd00::2/128']);
});
it.each(['true', '*', '0.0.0.0/0', '::/0', '172.20.0.2/33', 'bad/32', '172.20.0.2/24/1'])(
  'rejects unrestricted or malformed proxy %s',
  (value) => {
    expect(() => parseApiEnvironment({ ...valid, TRUST_PROXY_CIDRS: value })).toThrow(
      'TRUST_PROXY_CIDRS',
    );
  },
);
it('rejects a host that is not an explicit IP', () => {
  expect(() => parseApiEnvironment({ ...valid, API_HOST: 'unexpected-host' })).toThrow('API_HOST');
});

const initial = {
  NODE_ENV: 'production',
  DATABASE_URL: valid.DATABASE_URL,
  INITIAL_SETUP_CONFIRM: 'CREATE_FIRST_ORGANIZATION',
  INITIAL_ORGANIZATION_NAME: 'Synthetic Organization',
  INITIAL_BRANCH_NAME: 'Main',
  INITIAL_BRANCH_CODE: 'main',
  INITIAL_ADMIN_NAME: 'Initial Administrator',
  INITIAL_ADMIN_EMAIL: ' admin@example.test ',
  INITIAL_ADMIN_PASSWORD: 'synthetic-private-password',
};
it('normalizes initial identity and branch, without default credentials', () => {
  const config = parseInitialSetupEnvironment(initial);
  expect(config.INITIAL_ADMIN_EMAIL).toBe('admin@example.test');
  expect(config.INITIAL_BRANCH_CODE).toBe('MAIN');
});
it.each([
  'INITIAL_SETUP_CONFIRM',
  'INITIAL_ADMIN_PASSWORD',
  'INITIAL_ADMIN_EMAIL',
  'INITIAL_ORGANIZATION_NAME',
])('requires explicit initial setup field %s', (key) => {
  const input: Record<string, unknown> = { ...initial };
  delete input[key];
  expect(() => parseInitialSetupEnvironment(input)).toThrow(key);
});
it('restricts initial setup to production and preserves demo seed rejection', () => {
  expect(() => parseInitialSetupEnvironment({ ...initial, NODE_ENV: 'development' })).toThrow(
    'NODE_ENV',
  );
  expect(() =>
    parseSeedEnvironment({
      ...valid,
      NODE_ENV: 'production',
      SEED_ADMIN_PASSWORD: initial.INITIAL_ADMIN_PASSWORD,
    }),
  ).toThrow('NODE_ENV');
});
