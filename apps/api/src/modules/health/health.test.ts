import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { AuthService } from '../auth/index.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseApiEnvironment } from '@crm/config/server';
import { healthResponseSchema } from '@crm/contracts';
import { AppModule } from '../../app.module.js';
import { DatabaseService } from '../database/database.module.js';
import {
  RUNTIME_CONFIG,
  RedisService,
  StructuredLogger,
  TechnicalQueueService,
} from '../runtime/index.js';
import { configureHttp } from '../../bootstrap/http.js';
const config = parseApiEnvironment({
  NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('base64url'),
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  API_PORT: '3001',
  DATABASE_URL: 'postgresql://test:synthetic@localhost/crm',
  CORS_ORIGINS: 'http://localhost:3000',
  LOG_LEVEL: 'fatal',
});
@Controller('unconfigured-policy')
class MissingPolicyController {
  @Get() get() {
    return { status: 'should-not-be-visible' };
  }
}
let app: INestApplication;
let url: string;
const database = { ping: vi.fn<() => Promise<void>>() };
const redis = { ping: vi.fn<() => Promise<void>>() };
beforeEach(async () => {
  database.ping.mockReset().mockResolvedValue();
  redis.ping.mockReset().mockResolvedValue();
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [MissingPolicyController],
  })
    .overrideProvider(AuthService)
    .useValue({
      authenticate: vi
        .fn<
          () => Promise<{
            userId: string;
            sessionId: string;
            membershipId: null;
            contextVersion: number;
          }>
        >()
        .mockResolvedValue({
          userId: '9b150a17-f00e-4f2c-8730-513ff1fc9801',
          sessionId: '9b150a17-f00e-4f2c-8730-513ff1fc9802',
          membershipId: null,
          contextVersion: 0,
        }),
    })
    .overrideProvider(RUNTIME_CONFIG)
    .useValue(config)
    .overrideProvider(DatabaseService)
    .useValue(database)
    .overrideProvider(RedisService)
    .useValue(redis)
    .overrideProvider(TechnicalQueueService)
    .useValue({})
    .compile();
  app = module.createNestApplication({ logger: false });
  configureHttp(app, config, app.get(StructuredLogger));
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});
afterEach(async () => {
  await app.close();
});
it.each(['/health', '/health/ready'])('returns real HTTP contract for %s', async (path) => {
  const response = await fetch(url + path);
  expect(response.status).toBe(200);
  expect(healthResponseSchema.parse(await response.json())).toEqual({
    status: 'ok',
    services: { database: 'up', redis: 'up' },
  });
});
it('liveness does not call dependencies', async () => {
  const response = await fetch(url + '/health/live');
  expect(response.status).toBe(200);
  expect(database.ping).not.toHaveBeenCalled();
  expect(redis.ping).not.toHaveBeenCalled();
});
it.each(['database', 'redis'])(
  'returns 503 when %s fails without leaking errors',
  async (service) => {
    (service === 'database' ? database : redis).ping.mockRejectedValue(
      new Error('private-sensitive-value'),
    );
    const response = await fetch(url + '/health/ready');
    expect(response.status).toBe(503);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ status: 'unavailable', services: { [service]: 'down' } });
    expect(JSON.stringify(body)).not.toContain('private-sensitive-value');
  },
);
it('sets distinct request ID and validated correlation ID with security headers', async () => {
  const response = await fetch(url + '/health/live', {
    headers: { 'X-Correlation-Id': 'trace_1', Origin: 'http://localhost:3000' },
  });
  expect(response.headers.get('x-correlation-id')).toBe('trace_1');
  expect(response.headers.get('x-request-id')).not.toBe('trace_1');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
});
it('does not allow arbitrary CORS origin', async () => {
  const response = await fetch(url + '/health/live', {
    headers: { Origin: 'https://unauthorized.example' },
  });
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
});
it('documents only existing technical routes', async () => {
  const response = await fetch(url + '/docs/openapi.json');
  const body: unknown = await response.json();
  expect(body).toHaveProperty('paths./health');
  expect(body).toHaveProperty('paths./health/live');
  expect(body).toHaveProperty('paths./health/ready');
  expect(body).toHaveProperty(
    'paths./health.get.responses.200.content.application/json.schema.properties.status.enum',
    healthResponseSchema.shape.status.options,
  );
});
it('returns safe RFC 9457 errors with request ID inside the API prefix', async () => {
  const response = await fetch(url + '/api/v1/absent');
  expect(response.status).toBe(404);
  expect(response.headers.get('content-type')).toContain('application/problem+json');
  const body: unknown = await response.json();
  expect(body).toMatchObject({ status: 404, code: 'HTTP_404' });
  expect(body).toHaveProperty('requestId');
});

it('global authorization denies an authenticated route without explicit permission metadata', async () => {
  const response = await fetch(url + '/api/v1/unconfigured-policy', {
    headers: { Authorization: 'Bearer synthetic-test-principal' },
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toHaveProperty('code', 'FORBIDDEN');
});
