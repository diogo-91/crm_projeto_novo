import type { TimelineEntry } from '@crm/contracts';
import { Queue } from 'bullmq';
import { SignJWT, decodeJwt } from 'jose';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@crm/database';
import type { DatabaseClient } from '@crm/database';
import {
  taskResponseSchema,
  taskListResponseSchema,
  activityResponseSchema,
  timelineResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  reminderStatusSchema,
  leadResponseSchema,
  leadListResponseSchema,
  opportunityResponseSchema,
  opportunityListResponseSchema,
  pipelineResponseSchema,
  pipelineListResponseSchema,
  conversionResponseSchema,
  stageHistoryListResponseSchema,
  contactResponseSchema,
  contactListResponseSchema,
  companyResponseSchema,
  companyListResponseSchema,
  tagResponseSchema,
  tagListResponseSchema,
  assignmentListResponseSchema,
  authResponseSchema,
  meResponseSchema,
  organizationResponseSchema,
  branchResponseSchema,
  membershipResponseSchema,
  branchListResponseSchema,
  memberListResponseSchema,
} from '@crm/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';
const execute = promisify(execFile);
const project = `crm-test-${randomUUID()}`;
const children: { process: ChildProcess; logs: string[]; exit: Promise<void> }[] = [];
let directory: string;
let composeArgs: string[];
let environment: NodeJS.ProcessEnv;
let url: string;
let database: DatabaseClient | undefined;
async function compose(...args: string[]): Promise<string> {
  const result = await execute('docker', [...composeArgs, ...args], {
    timeout: 90000,
    maxBuffer: 1024 * 1024,
  });
  return result.stdout.trim();
}
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to allocate API port');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}
function start(path: string) {
  const process = spawn(globalThis.process.execPath, [path], {
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs: string[] = [];
  process.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  process.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  const exit = new Promise<void>((resolve, reject) => {
    process.once('error', reject);
    process.once('close', (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error('Child process did not exit cleanly'));
    });
  });
  const child = { process, logs, exit };
  children.push(child);
  return child;
}
async function until(
  condition: () => Promise<boolean>,
  description: string,
  timeoutMs = 20000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'crm-foundation-'));
  const databasePassword = randomBytes(24).toString('hex');
  const redisPassword = randomBytes(24).toString('hex');
  const envFile = join(directory, '.env');
  await writeFile(
    envFile,
    `POSTGRES_DB=crm_test\nPOSTGRES_USER=crm_test\nPOSTGRES_PASSWORD=${databasePassword}\nPOSTGRES_PORT=0\nREDIS_PORT=0\nREDIS_PASSWORD=${redisPassword}\n`,
    { mode: 0o600 },
  );
  composeArgs = [
    'compose',
    '--file',
    'docker-compose.yml',
    '--env-file',
    envFile,
    '--project-name',
    project,
  ];
  await compose('up', '-d', '--wait', 'postgres', 'redis');
  const databasePort = (await compose('port', 'postgres', '5432')).split(':').at(-1);
  const redisPort = (await compose('port', 'redis', '6379')).split(':').at(-1);
  const apiPort = await freePort();
  environment = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: randomBytes(32).toString('base64url'),
    SEED_ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
    SEED_PLATFORM_PROVISIONING: 'true',
    AUTH_LOGIN_IP_LIMIT: '1000',
    AUTH_LOGIN_IDENTITY_LIMIT: '500',
    AUTH_REFRESH_IP_LIMIT: '1000',
    API_PORT: String(apiPort),
    LOG_LEVEL: 'info',
    DATABASE_URL: `postgresql://crm_test:${databasePassword}@127.0.0.1:${databasePort}/crm_test`,
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: redisPort,
    REDIS_PASSWORD: redisPassword,
    CORS_ORIGINS: 'http://localhost:3000',
  };
  url = `http://127.0.0.1:${apiPort}`;
  await execute('pnpm', ['--filter', '@crm/database', 'db:migrate:deploy'], {
    env: environment,
    timeout: 30000,
  });
  const databaseUrl = environment['DATABASE_URL'];
  if (!databaseUrl) throw new Error('Integration database URL is required');
  database = createDatabaseClient(databaseUrl);
  await database.$connect();
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  start('apps/api/dist/bootstrap/main.js');
  const worker = start('apps/worker/dist/bootstrap/main.js');
  await until(async () => {
    try {
      return (
        (await fetch(`${url}/health/ready`, { signal: AbortSignal.timeout(2000) })).status === 200
      );
    } catch (error: unknown) {
      if (error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError'))
        return false;
      throw error;
    }
  }, 'API readiness');
  await until(
    () => Promise.resolve(worker.logs.join('').includes('worker ready')),
    'worker readiness',
  );
});
afterAll(async () => {
  const shutdowns = await Promise.allSettled([
    ...(database ? [database.$disconnect()] : []),
    ...children.map(async (child) => {
      if (child.process.exitCode === null && child.process.signalCode === null)
        child.process.kill('SIGTERM');
      await Promise.race([
        child.exit,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('Graceful shutdown timeout')), 10000).unref(),
        ),
      ]);
      expect(child.logs.join('')).toContain('shutdown complete');
    }),
  ]);
  try {
    if (composeArgs) await compose('down', '--volumes', '--remove-orphans');
  } finally {
    if (directory) await rm(directory, { recursive: true });
  }
  const errors: unknown[] = [];
  for (const result of shutdowns) {
    if (result.status === 'rejected') errors.push(result.reason);
  }
  if (errors.length > 0) throw new AggregateError(errors, 'Process shutdown failed');
});
it('applies migration twice and executes a real idempotent technical seed', async () => {
  await execute('pnpm', ['--filter', '@crm/database', 'db:migrate:deploy'], {
    env: environment,
    timeout: 30000,
  });
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  const result = await compose(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'crm_test',
    '-d',
    'crm_test',
    '-tAc',
    "SELECT count(*) FROM infrastructure_metadata WHERE key='foundation' AND version=1",
  );
  expect(result).toBe('1');
});
it.each(['/health', '/health/live', '/health/ready'])(
  'serves %s against real PostgreSQL and Redis',
  async (path) => {
    const response = await fetch(url + path);
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('status', 'ok');
  },
);
it('serves Swagger UI and valid documented technical paths', async () => {
  const ui = await fetch(url + '/docs');
  expect(ui.status).toBe(200);
  expect(await ui.text()).toContain('Swagger UI');
  const document = await fetch(url + '/docs/openapi.json');
  const body: unknown = await document.json();
  expect(body).toHaveProperty('paths./health/ready');
});
it('API queue producer receives the result from the separate worker process', async () => {
  const result = await execute(process.execPath, ['apps/api/dist/bootstrap/queue-probe.js'], {
    env: environment,
    timeout: 20000,
  });
  expect(result.stdout).toContain('queue probe completed');
  expect(children[1]?.logs.join('')).toContain('technical job completed');
});
it.each(['redis', 'postgres'])(
  'reports unavailable %s and then recovers without restarting API',
  async (service) => {
    const bearer = await adminToken();
    await compose('pause', service);
    try {
      const response = await fetch(url + '/health/ready');
      expect(response.status).toBe(503);
      const body: unknown = await response.json();
      expect(body).toHaveProperty(
        `services.${service === 'postgres' ? 'database' : 'redis'}`,
        'down',
      );
      expect((await fetch(url + '/health/live')).status).toBe(200);
      expect((await fetch(url + '/health')).status).toBe(503);
      if (service === 'postgres') {
        const unavailable = await fetch(`${url}/api/v1/organizations/${randomUUID()}`, {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        expect(unavailable.status).toBe(500);
        const problem: unknown = await unavailable.json();
        expect(problem).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
        expect(JSON.stringify(problem)).not.toMatch(/Prisma|postgresql|SELECT|crm_test/);
      }
    } finally {
      await compose('unpause', service);
    }
    await until(
      async () => (await fetch(url + '/health/ready')).status === 200,
      `${service} recovery`,
    );
  },
);

function db(): DatabaseClient {
  if (!database) throw new Error('Integration database has not been initialized');
  return database;
}
const tokens = new Map<string, Promise<string>>();
async function authRequest(
  path: string,
  payload: unknown = {},
  options: { token?: string; cookie?: string; origin?: string; method?: string } = {},
) {
  return fetch(url + '/api/v1/auth' + path, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: options.origin ?? 'http://localhost:3000',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.method === 'GET' ? {} : { body: JSON.stringify(payload) }),
  });
}
async function login(
  email = 'admin.demo@example.test',
  password = environment['SEED_ADMIN_PASSWORD'],
) {
  if (!password) throw new Error('Synthetic seed password absent');
  const response = await authRequest('/login', { email, password });
  expect(response.status).toBe(200);
  const body = authResponseSchema.parse(await response.json());
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Refresh cookie missing');
  return { body, cookie, response };
}
async function adminToken(organizationId?: string) {
  const key = organizationId ?? 'platform';
  let pending = tokens.get(key);
  if (!pending) {
    pending = (async () => {
      const signed = await login();
      if (!organizationId || signed.body.context?.organizationId === organizationId)
        return signed.body.accessToken;
      const selected = await authRequest(
        '/context',
        { organizationId },
        { token: signed.body.accessToken },
      );
      if (selected.status === 403) {
        const demo = await authRequest(
          '/context',
          { organizationId: '9b150a17-f00e-4f2c-8730-513ff1fc9801' },
          { token: signed.body.accessToken },
        );
        expect(demo.status).toBe(200);
        return authResponseSchema.parse(await demo.json()).accessToken;
      }
      expect(selected.status).toBe(200);
      return authResponseSchema.parse(await selected.json()).accessToken;
    })();
    tokens.set(key, pending);
  }
  return pending;
}
async function request(path: string, payload?: unknown) {
  const organizationId = /^\/organizations\/([0-9a-f-]{36})(?:[/?]|$)/.exec(path)?.[1];
  const token = await adminToken(organizationId);
  return fetch(url + '/api/v1' + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }),
  });
}
async function organization(name = 'Integration organization') {
  const response = await request('/organizations', { name });
  expect(response.status).toBe(201);
  return organizationResponseSchema.parse(await response.json());
}
async function branch(organizationId: string, code = 'CENTRO') {
  const response = await request(`/organizations/${organizationId}/branches`, {
    name: 'Branch',
    code,
  });
  expect(response.status).toBe(201);
  return branchResponseSchema.parse(await response.json());
}
async function identity(organizationId: string, branchIds: string[] = []) {
  const email = `${randomUUID()}@example.test`;
  const response = await request(`/organizations/${organizationId}/users`, {
    name: 'User',
    email,
    branchIds,
    ...(branchIds[0] ? { primaryBranchId: branchIds[0] } : {}),
  });
  expect(response.status).toBe(201);
  return membershipResponseSchema.parse(await response.json());
}
it('seed twice preserves demo IDs, one organization, five branches, one identity and membership', async () => {
  const first = await db().organization.findUniqueOrThrow({
    where: { id: '9b150a17-f00e-4f2c-8730-513ff1fc9801' },
    include: { branches: true, memberships: { include: { user: true, branches: true } } },
  });
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  const second = await db().organization.findUniqueOrThrow({
    where: { id: first.id },
    include: { branches: true, memberships: { include: { user: true, branches: true } } },
  });
  expect(second).toEqual(first);
  expect(second.branches).toHaveLength(5);
  expect(second.memberships).toHaveLength(1);
  expect(second.memberships[0]?.branches).toHaveLength(5);
  expect(second.memberships[0]?.user.email).toBe('admin.demo@example.test');
  expect(await db().user.count()).toBe(1);
});
it('HTTP creates and retrieves organization with normalized optional international document', async () => {
  const response = await request('/organizations', {
    name: ' Org A ',
    legalName: ' Legal ',
    document: 'GB-123.456/789',
  });
  expect(response.status).toBe(201);
  const created = organizationResponseSchema.parse(await response.json());
  expect(created).toMatchObject({
    name: 'Org A',
    legalName: 'Legal',
    document: 'GB123456789',
    active: true,
  });
  const read = await request(`/organizations/${created.id}`);
  expect(read.status).toBe(200);
  expect(organizationResponseSchema.parse(await read.json())).toEqual(created);
  expect(
    (await request('/organizations', { name: 'Other jurisdiction', document: 'GB123456789' }))
      .status,
  ).toBe(201);
});
it('HTTP rejects invalid UUIDs, email, pagination and mass assignment with safe 400 responses', async () => {
  const org = await organization();
  const responses = [
    await request('/organizations/not-a-uuid'),
    await request('/organizations', { name: 'Org', active: false }),
    await request(`/organizations/${org.id}/users`, { name: 'User', email: 'invalid' }),
    await request(`/organizations/${org.id}/users`, {
      name: 'User',
      email: 'user@example.test',
      passwordHash: 'sensitive-input',
    }),
    await request(`/organizations/${org.id}/branches?limit=101`),
    await request(`/organizations/${org.id}/branches?organizationId=${randomUUID()}`),
  ];
  for (const response of responses) {
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    const body: unknown = await response.json();
    expect(body).toMatchObject({ code: 'INVALID_INPUT', status: 400 });
    expect(body).toHaveProperty('requestId');
    expect(JSON.stringify(body)).not.toContain('sensitive-input');
  }
});
it('HTTP returns 404 for missing organization and missing user without Prisma details', async () => {
  const org = await organization();
  for (const response of [
    await request(`/organizations/${randomUUID()}`),
    await request(`/organizations/${randomUUID()}/branches`, { name: 'Branch', code: 'A' }),
    await request(`/organizations/${org.id}/memberships`, { userId: randomUUID() }),
  ]) {
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /Prisma|postgresql|constraint|SELECT/,
    );
  }
});
it('HTTP branch code is normalized, unique per tenant and safe under concurrent creation', async () => {
  const a = await organization('A');
  const b = await organization('B');
  const results = await Promise.all([
    request(`/organizations/${a.id}/branches`, { name: 'A1', code: ' centro ' }),
    request(`/organizations/${a.id}/branches`, { name: 'A2', code: 'CENTRO' }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await db().branch.count({ where: { organizationId: a.id, code: 'CENTRO' } })).toBe(1);
  expect((await branch(b.id)).code).toBe('CENTRO');
});
it('HTTP creates a normalized global identity, membership and primary branch atomically', async () => {
  const org = await organization();
  const store = await branch(org.id);
  const email = `${randomUUID()}@example.test`;
  const response = await request(`/organizations/${org.id}/users`, {
    name: ' Ana ',
    email: ` ${email.toUpperCase()} `,
    branchIds: [store.id],
    primaryBranchId: store.id,
  });
  expect(response.status).toBe(201);
  const member = membershipResponseSchema.parse(await response.json());
  expect(member).toMatchObject({
    organizationId: org.id,
    primaryBranchId: store.id,
    branchIds: [store.id],
    user: { name: 'Ana', email, active: true },
  });
  expect(member.user).not.toHaveProperty('passwordHash');
  expect(member.user).not.toHaveProperty('organizationId');
  expect(
    await db().membershipBranch.count({
      where: { membershipId: member.id, organizationId: org.id, branchId: store.id },
    }),
  ).toBe(1);
});
it('HTTP duplicate email is globally unique under concurrent creation and rolls back membership', async () => {
  const a = await organization('Email A');
  const b = await organization('Email B');
  const email = `${randomUUID()}@example.test`;
  const results = await Promise.all([
    request(`/organizations/${a.id}/users`, { name: 'User A', email }),
    request(`/organizations/${b.id}/users`, { name: 'User B', email: email.toUpperCase() }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  const user = await db().user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });
  expect(user.memberships).toHaveLength(1);
  const conflict = results.find((result) => result.status === 409);
  if (!conflict) throw new Error('Missing conflict response');
  expect(await conflict.json()).toMatchObject({ code: 'RESOURCE_CONFLICT' });
});
it('HTTP explicitly links one global identity to another organization without duplicating user', async () => {
  const a = await organization('Global A');
  const b = await organization('Global B');
  const storeA = await branch(a.id);
  const storeB = await branch(b.id);
  const memberA = await identity(a.id, [storeA.id]);
  const response = await request(`/organizations/${b.id}/memberships`, {
    userId: memberA.user.id,
    branchIds: [storeB.id],
    primaryBranchId: storeB.id,
  });
  expect(response.status).toBe(201);
  const memberB = membershipResponseSchema.parse(await response.json());
  expect(memberB.user.id).toBe(memberA.user.id);
  expect(memberB.organizationId).toBe(b.id);
  expect(memberB.primaryBranchId).toBe(storeB.id);
  expect(await db().user.count({ where: { email: memberA.user.email } })).toBe(1);
  expect(
    (await request(`/organizations/${b.id}/memberships`, { userId: memberA.user.id })).status,
  ).toBe(409);
});
it('HTTP rejects cross-tenant branch membership and leaves no new global identity behind', async () => {
  const a = await organization('Tenant A');
  const b = await organization('Tenant B');
  const branchB = await branch(b.id);
  const email = `${randomUUID()}@example.test`;
  const response = await request(`/organizations/${a.id}/users`, {
    name: 'Invalid association',
    email,
    branchIds: [branchB.id],
    primaryBranchId: branchB.id,
  });
  expect(response.status).toBe(404);
  expect(await db().user.findUnique({ where: { email } })).toBeNull();
  expect(await db().organizationMembership.count({ where: { organizationId: a.id } })).toBe(1);
});
it('HTTP rejects duplicate assignments and a primary branch not explicitly assigned', async () => {
  const org = await organization();
  const store = await branch(org.id);
  const user = await identity(org.id);
  const target = await organization();
  expect(
    (
      await request(`/organizations/${target.id}/memberships`, {
        userId: user.user.id,
        primaryBranchId: store.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(`/organizations/${org.id}/users`, {
        name: 'User',
        email: `${randomUUID()}@example.test`,
        branchIds: [store.id, store.id],
      })
    ).status,
  ).toBe(400);
});
it('HTTP blocks new links for inactive users, branches and organizations', async () => {
  const a = await organization();
  const b = await organization();
  const store = await branch(b.id);
  const user = await identity(a.id);
  await db().user.update({ where: { id: user.user.id }, data: { active: false } });
  expect(
    (await request(`/organizations/${b.id}/memberships`, { userId: user.user.id })).status,
  ).toBe(409);
  await db().branch.update({ where: { id: store.id }, data: { active: false } });
  expect(
    (
      await request(`/organizations/${b.id}/users`, {
        name: 'User',
        email: `${randomUUID()}@example.test`,
        branchIds: [store.id],
      })
    ).status,
  ).toBe(409);
  await db().organization.update({ where: { id: b.id }, data: { active: false } });
  expect(
    (await request(`/organizations/${b.id}/branches`, { name: 'Branch', code: 'NEW' })).status,
  ).toBe(403);
  expect(
    (
      await request(`/organizations/${b.id}/users`, {
        name: 'User',
        email: `${randomUUID()}@example.test`,
      })
    ).status,
  ).toBe(403);
});
it('HTTP paginated lists retain organization filter, including a foreign cursor', async () => {
  const a = await organization('List A');
  const b = await organization('List B');
  await branch(a.id, 'A1');
  await branch(a.id, 'A2');
  const branchB = await branch(b.id);
  const userA = await identity(a.id);
  const userB = await identity(b.id);
  const first = branchListResponseSchema.parse(
    await (await request(`/organizations/${a.id}/branches?limit=1`)).json(),
  );
  expect(first.data).toHaveLength(1);
  expect(first.pageInfo.hasNextPage).toBe(true);
  const second = branchListResponseSchema.parse(
    await (
      await request(`/organizations/${a.id}/branches?limit=1&cursor=${first.pageInfo.nextCursor}`)
    ).json(),
  );
  expect(second.data).toHaveLength(1);
  expect(second.data[0]?.id).not.toBe(first.data[0]?.id);
  expect(second.pageInfo.hasNextPage).toBe(false);
  const foreignCursor = branchListResponseSchema.parse(
    await (await request(`/organizations/${a.id}/branches?cursor=${branchB.id}`)).json(),
  );
  expect(foreignCursor.data.every((row) => row.organizationId === a.id)).toBe(true);
  const membersA = memberListResponseSchema.parse(
    await (await request(`/organizations/${a.id}/users`)).json(),
  );
  const membersB = memberListResponseSchema.parse(
    await (await request(`/organizations/${b.id}/users`)).json(),
  );
  expect(membersA.data.map((row) => row.user.id)).toContain(userA.user.id);
  expect(membersA.data).toHaveLength(2);
  expect(membersB.data.map((row) => row.user.id)).toContain(userB.user.id);
  expect(membersB.data).toHaveLength(2);
});
it('database rejects cross-tenant membership branch foreign keys, independently of API', async () => {
  const a = await organization('FK A');
  const b = await organization('FK B');
  const storeA = await branch(a.id);
  const storeB = await branch(b.id);
  const memberA = await identity(a.id);
  const memberB = await identity(b.id);
  await expect(
    db().membershipBranch.create({
      data: { organizationId: a.id, membershipId: memberB.id, branchId: storeA.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().membershipBranch.create({
      data: { organizationId: a.id, membershipId: memberA.id, branchId: storeB.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().organizationMembership.update({
      where: { id: memberA.id },
      data: { primaryBranchId: storeB.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().organizationMembership.update({
      where: { id: memberA.id },
      data: { primaryBranchId: storeA.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('database rejects orphan branches and memberships, duplicate links and deletion of assigned primary branch', async () => {
  await expect(
    db().branch.create({ data: { organizationId: randomUUID(), name: 'Orphan', code: 'ORPHAN' } }),
  ).rejects.toMatchObject({ code: 'P2003' });
  const org = await organization();
  const store = await branch(org.id);
  const member = await identity(org.id, [store.id]);
  await expect(
    db().organizationMembership.create({ data: { organizationId: org.id, userId: randomUUID() } }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().organizationMembership.create({
      data: { organizationId: randomUUID(), userId: member.user.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().membershipBranch.create({
      data: { organizationId: org.id, membershipId: member.id, branchId: store.id },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
  await expect(
    db().membershipBranch.delete({
      where: {
        organizationId_membershipId_branchId: {
          organizationId: org.id,
          membershipId: member.id,
          branchId: store.id,
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('database enforces canonical email, code and document for direct writes', async () => {
  const org = await organization();
  await expect(
    db().user.create({ data: { name: 'User', email: ' Upper@EXAMPLE.TEST ' } }),
  ).rejects.toThrow();
  await expect(
    db().branch.create({ data: { organizationId: org.id, name: 'Branch', code: 'lowercase' } }),
  ).rejects.toThrow();
  await expect(
    db().organization.create({ data: { name: 'Invalid doc', document: 'gb-123' } }),
  ).rejects.toThrow();
});
it('Swagger documents implemented organizational contracts with bearer security and without internal password fields', async () => {
  const document: unknown = await (await fetch(url + '/docs/openapi.json')).json();
  expect(document).toHaveProperty('paths./api/v1/organizations.post');
  expect(document).toHaveProperty('paths./api/v1/organizations/{organizationId}/memberships.post');
  expect(JSON.stringify(document)).not.toContain('passwordHash');
  expect(document).toHaveProperty(
    'paths./api/v1/organizations/{organizationId}/users.post.requestBody.content.application/json.schema.additionalProperties',
    false,
  );
});

it('database migration history on an empty PostgreSQL contains all eight successful immutable migrations', async () => {
  const migrations = await db().$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
  expect(migrations.map((row) => row.migration_name)).toEqual([
    '20261006130000_infrastructure_metadata',
    '20261006144000_create_organization_branch_user_foundation',
    '20261006180000_create_auth_sessions_rbac',
    '20261006190000_enforce_grant_branch_reparenting',
    '20261007120000_create_contacts_companies_tags',
    '20261007123000_create_assignment_history',
    '20261007150000_create_leads_pipelines_opportunities',
    '20261007200000_create_tasks_activities_reminders',
  ]);
  expect(migrations.every((row) => row.finished_at !== null && row.rolled_back_at === null)).toBe(
    true,
  );
});
it('HTTP concurrent membership association relies on tenant-user uniqueness', async () => {
  const source = await organization();
  const target = await organization();
  const member = await identity(source.id);
  const results = await Promise.all([
    request(`/organizations/${target.id}/memberships`, { userId: member.user.id }),
    request(`/organizations/${target.id}/memberships`, { userId: member.user.id }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(
    await db().organizationMembership.count({
      where: { organizationId: target.id, userId: member.user.id },
    }),
  ).toBe(1);
});

it('demo seed refuses production and returns a nonzero exit without changing data', async () => {
  const before = await db().organization.count();
  await expect(
    execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], {
      env: { ...environment, NODE_ENV: 'production' },
    }),
  ).rejects.toMatchObject({ code: 1 });
  expect(await db().organization.count()).toBe(before);
});

async function authenticated(
  path: string,
  token: string,
  payload?: unknown,
  method = payload === undefined ? 'GET' : 'POST',
) {
  return fetch(url + '/api/v1' + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}
async function credentialUser(organizationId: string, branches: string[] = []) {
  const member = await identity(organizationId, branches);
  const demo = await db().user.findUniqueOrThrow({ where: { email: 'admin.demo@example.test' } });
  if (!demo.passwordHash) throw new Error('Demo hash not initialized');
  await db().user.update({
    where: { id: member.user.id },
    data: { passwordHash: demo.passwordHash },
  });
  return member;
}
async function tenantRole(organizationId: string, code: string) {
  return db().role.findUniqueOrThrow({ where: { organizationId_code: { organizationId, code } } });
}
async function assign(
  organizationId: string,
  membershipId: string,
  code: string,
  scope: 'OWN' | 'BRANCH' | 'BRANCH_SET' | 'ORGANIZATION',
  branchIds: string[] = [],
) {
  const role = await tenantRole(organizationId, code);
  const response = await request(
    `/organizations/${organizationId}/memberships/${membershipId}/roles`,
    { roleId: role.id, scope, branchIds },
  );
  expect(response.status).toBe(201);
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('id' in data) || typeof data.id !== 'string')
    throw new Error('Assignment ID missing');
  return data.id;
}
function sessionId(token: string) {
  const id: unknown = decodeJwt(token)['sid'];
  if (typeof id !== 'string') throw new Error('Session ID missing');
  return id;
}
it('all seven phase-2 administrative routes reject anonymous requests, including writes', async () => {
  const id = randomUUID();
  for (const [path, payload] of [
    ['/organizations', { name: 'Denied' }],
    [`/organizations/${id}`, undefined],
    [`/organizations/${id}/branches`, { name: 'Denied', code: 'DENIED' }],
    [`/organizations/${id}/branches`, undefined],
    [`/organizations/${id}/users`, { name: 'Denied', email: 'denied@example.test' }],
    [`/organizations/${id}/users`, undefined],
    [`/organizations/${id}/memberships`, { userId: randomUUID() }],
  ] as const) {
    const response = await fetch(url + '/api/v1' + path, {
      ...(payload
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        : {}),
    });
    expect(response.status).toBe(401);
  }
});
it('login uses normalized email, secure cookie attributes, minimal JWT and hashed refresh storage', async () => {
  const signed = await login(' ADMIN.DEMO@EXAMPLE.TEST ');
  expect(signed.response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(signed.response.headers.get('set-cookie')).toContain('SameSite=Lax');
  expect(signed.response.headers.get('set-cookie')).toContain('Path=/');
  expect(signed.response.headers.get('cache-control')).toBe('no-store');
  const me = await authRequest('/me', {}, { token: signed.body.accessToken, method: 'GET' });
  expect(meResponseSchema.parse(await me.json()).user.id).toBe(signed.body.user.id);
  const payload = decodeJwt(signed.body.accessToken);
  expect(Object.keys(payload).sort()).toEqual(['aud', 'cv', 'exp', 'iat', 'iss', 'sid', 'sub']);
  const raw = signed.cookie.split('=')[1];
  if (!raw) throw new Error('Refresh missing');
  const refresh = await db().refreshToken.findUniqueOrThrow({
    where: { tokenHash: createHash('sha256').update(raw).digest('hex') },
  });
  expect(refresh.tokenHash).not.toBe(raw);
  expect(JSON.stringify(signed.body)).not.toMatch(
    /passwordHash|securityVersion|tokenHash|refreshToken/,
  );
  expect(signed.response.headers.get('access-control-allow-credentials')).toBe('true');
});
it('missing, wrong, inactive and credential-free users receive the same generic login error', async () => {
  const org = await organization();
  const inactive = await credentialUser(org.id);
  const structural = await identity(org.id);
  await db().user.update({ where: { id: inactive.user.id }, data: { active: false } });
  const responses = await Promise.all([
    authRequest('/login', {
      email: `${randomUUID()}@example.test`,
      password: 'Invalid password 1',
    }),
    authRequest('/login', { email: 'admin.demo@example.test', password: 'Invalid password 1' }),
    authRequest('/login', {
      email: inactive.user.email,
      password: environment['SEED_ADMIN_PASSWORD'],
    }),
    authRequest('/login', {
      email: structural.user.email,
      password: environment['SEED_ADMIN_PASSWORD'],
    }),
  ]);
  for (const response of responses) {
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      detail: 'Invalid credentials or session.',
    });
  }
});
it('cookie flows require allowed Origin and JSON; strict input blocks credential mass assignment', async () => {
  const signed = await login();
  expect(
    (await authRequest('/refresh', {}, { cookie: signed.cookie, origin: 'https://evil.example' }))
      .status,
  ).toBe(403);
  expect(
    (
      await fetch(url + '/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: signed.cookie },
        body: '{}',
      })
    ).status,
  ).toBe(403);
  expect(
    (await authRequest('/logout', {}, { cookie: signed.cookie, origin: 'https://evil.example' }))
      .status,
  ).toBe(403);
  expect(
    (
      await authRequest('/login', {
        email: 'admin.demo@example.test',
        password: environment['SEED_ADMIN_PASSWORD'],
        active: true,
      })
    ).status,
  ).toBe(400);
  expect(
    (await authRequest('/refresh', { refreshToken: signed.cookie }, { cookie: signed.cookie }))
      .status,
  ).toBe(400);
  expect(
    (
      await fetch(url + '/api/v1/auth/login', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'text/plain' },
        body: '{}',
      })
    ).status,
  ).toBe(400);
  expect(
    (await fetch(url + '/api/v1/auth/me', { headers: { Cookie: signed.cookie } })).status,
  ).toBe(401);
});
it('one active membership auto-selects; multiple memberships require explicit context and invalidate prior access on switching', async () => {
  const a = await organization();
  const b = await organization();
  const member = await credentialUser(a.id);
  const single = await login(member.user.email);
  expect(single.body.context?.organizationId).toBe(a.id);
  expect(
    (await request(`/organizations/${b.id}/memberships`, { userId: member.user.id })).status,
  ).toBe(201);
  const multiple = await login(member.user.email);
  expect(multiple.body.context).toBeNull();
  expect(multiple.body.memberships).toHaveLength(2);
  expect((await authenticated(`/organizations/${a.id}`, multiple.body.accessToken)).status).toBe(
    403,
  );
  const selected = await authRequest(
    '/context',
    { organizationId: a.id },
    { token: multiple.body.accessToken },
  );
  expect(selected.status).toBe(200);
  const body = authResponseSchema.parse(await selected.json());
  expect(body.context?.membershipId).toBe(member.id);
  expect(
    (await authRequest('/me', {}, { token: multiple.body.accessToken, method: 'GET' })).status,
  ).toBe(401);
  const switched = await authRequest(
    '/context',
    { organizationId: b.id },
    { token: body.accessToken },
  );
  expect(switched.status).toBe(200);
  expect((await authRequest('/me', {}, { token: body.accessToken, method: 'GET' })).status).toBe(
    401,
  );
});
it('refresh rotates once; reuse commits family revocation and rejects both descendant refresh and access immediately', async () => {
  const signed = await login();
  const rotated = await authRequest('/refresh', {}, { cookie: signed.cookie });
  expect(rotated.status).toBe(200);
  const body = authResponseSchema.parse(await rotated.json());
  const cookie = rotated.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Rotated cookie missing');
  expect(cookie).not.toBe(signed.cookie);
  expect((await authRequest('/refresh', {}, { cookie: signed.cookie })).status).toBe(401);
  expect((await authRequest('/refresh', {}, { cookie })).status).toBe(401);
  expect((await authRequest('/me', {}, { token: body.accessToken, method: 'GET' })).status).toBe(
    401,
  );
  expect(
    (await db().session.findUniqueOrThrow({ where: { id: sessionId(body.accessToken) } }))
      .revokedAt,
  ).not.toBeNull();
});
it('concurrent refresh consumes a generation once and revokes the family upon detected reuse', async () => {
  const signed = await login();
  const responses = await Promise.all([
    authRequest('/refresh', {}, { cookie: signed.cookie }),
    authRequest('/refresh', {}, { cookie: signed.cookie }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  expect(
    await db().refreshToken.count({ where: { sessionId: sessionId(signed.body.accessToken) } }),
  ).toBe(2);
  expect(
    (await db().session.findUniqueOrThrow({ where: { id: sessionId(signed.body.accessToken) } }))
      .revokedAt,
  ).not.toBeNull();
});
it('logout revokes only the current device; logout-all revokes all devices and refreshes', async () => {
  const org = await organization();
  const member = await credentialUser(org.id);
  const one = await login(member.user.email);
  const two = await login(member.user.email);
  expect(sessionId(one.body.accessToken)).not.toBe(sessionId(two.body.accessToken));
  expect((await authRequest('/logout', {}, { cookie: one.cookie })).status).toBe(204);
  expect(
    (await authRequest('/me', {}, { token: one.body.accessToken, method: 'GET' })).status,
  ).toBe(401);
  expect((await authRequest('/refresh', {}, { cookie: one.cookie })).status).toBe(401);
  expect(
    (await authRequest('/me', {}, { token: two.body.accessToken, method: 'GET' })).status,
  ).toBe(200);
  expect((await authRequest('/logout-all', {}, { token: two.body.accessToken })).status).toBe(204);
  expect((await authRequest('/refresh', {}, { cookie: two.cookie })).status).toBe(401);
});
it('password change validates current password, enforces policy, replaces hash and revokes every device', async () => {
  const org = await organization();
  const member = await credentialUser(org.id);
  const one = await login(member.user.email);
  const two = await login(member.user.email);
  const password = randomBytes(24).toString('base64url');
  expect(
    (
      await authRequest(
        '/change-password',
        { currentPassword: 'wrong', newPassword: password },
        { token: one.body.accessToken },
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await authRequest(
        '/change-password',
        { currentPassword: environment['SEED_ADMIN_PASSWORD'], newPassword: 'short' },
        { token: one.body.accessToken },
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await authRequest(
        '/change-password',
        { currentPassword: environment['SEED_ADMIN_PASSWORD'], newPassword: password },
        { token: one.body.accessToken },
      )
    ).status,
  ).toBe(204);
  for (const signed of [one, two]) {
    expect(
      (await authRequest('/me', {}, { token: signed.body.accessToken, method: 'GET' })).status,
    ).toBe(401);
    expect((await authRequest('/refresh', {}, { cookie: signed.cookie })).status).toBe(401);
  }
  expect(
    (
      await authRequest('/login', {
        email: member.user.email,
        password: environment['SEED_ADMIN_PASSWORD'],
      })
    ).status,
  ).toBe(401);
  expect((await login(member.user.email, password)).body.user.id).toBe(member.user.id);
});
it('rejects invalid signatures, algorithms, expiry, issuer, audience and forged session/context claims', async () => {
  const signed = await login();
  const payload = decodeJwt(signed.body.accessToken);
  const key = Buffer.from(environment['JWT_SECRET'] ?? '', 'base64url');
  const cases = [
    { key: randomBytes(32), payload, algorithm: 'HS256' },
    { key, payload, algorithm: 'HS384' },
    { key, payload: { ...payload, exp: Math.floor(Date.now() / 1000) - 1 }, algorithm: 'HS256' },
    { key, payload: { ...payload, iss: 'evil' }, algorithm: 'HS256' },
    { key, payload: { ...payload, aud: 'other' }, algorithm: 'HS256' },
    { key, payload: { ...payload, sid: randomUUID() }, algorithm: 'HS256' },
    { key, payload: { ...payload, cv: 900 }, algorithm: 'HS256' },
    {
      key,
      payload: { ...payload, exp: Math.floor(Date.now() / 1000) + 86400 },
      algorithm: 'HS256',
    },
  ];
  for (const item of cases) {
    const token = await new SignJWT(item.payload)
      .setProtectedHeader({ alg: item.algorithm, typ: 'JWT' })
      .sign(item.key);
    expect((await authRequest('/me', {}, { token, method: 'GET' })).status).toBe(401);
  }
});
it('expired session rejects an otherwise valid access token and refresh token', async () => {
  const signed = await login();
  await db().session.update({
    where: { id: sessionId(signed.body.accessToken) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  expect(
    (await authRequest('/me', {}, { token: signed.body.accessToken, method: 'GET' })).status,
  ).toBe(401);
  expect((await authRequest('/refresh', {}, { cookie: signed.cookie })).status).toBe(401);
});
it('active JWT never preserves inactive user, membership or organization authorization', async () => {
  for (const kind of ['user', 'membership', 'organization'] as const) {
    const org = await organization();
    const member = await credentialUser(org.id);
    await assign(org.id, member.id, 'VIEWER', 'ORGANIZATION');
    const signed = await login(member.user.email);
    if (kind === 'user')
      await db().user.update({ where: { id: member.user.id }, data: { active: false } });
    if (kind === 'membership')
      await db().organizationMembership.update({
        where: { id: member.id },
        data: { active: false },
      });
    if (kind === 'organization')
      await db().organization.update({ where: { id: org.id }, data: { active: false } });
    expect(
      (await authenticated(`/organizations/${org.id}/branches`, signed.body.accessToken)).status,
    ).toBe(kind === 'user' ? 401 : 403);
    expect((await authRequest('/refresh', {}, { cookie: signed.cookie })).status).toBe(401);
  }
});
it('tenant A cannot read tenant B, assign its roles, use its branch or switch into B', async () => {
  const a = await organization();
  const b = await organization();
  const storeB = await branch(b.id);
  const memberA = await credentialUser(a.id);
  const memberB = await credentialUser(b.id);
  await assign(a.id, memberA.id, 'ADMIN', 'ORGANIZATION');
  await assign(b.id, memberB.id, 'ADMIN', 'ORGANIZATION');
  const signed = await login(memberA.user.email);
  const roleB = await tenantRole(b.id, 'ADMIN');
  for (const path of [
    `/organizations/${b.id}`,
    `/organizations/${b.id}/branches`,
    `/organizations/${b.id}/users`,
    `/organizations/${b.id}/roles`,
  ])
    expect((await authenticated(path, signed.body.accessToken)).status).toBe(404);
  expect(
    (
      await authenticated(
        `/organizations/${b.id}/memberships/${memberB.id}/roles`,
        signed.body.accessToken,
        { roleId: roleB.id, scope: 'ORGANIZATION' },
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await authenticated(
        `/organizations/${a.id}/memberships/${memberA.id}/roles`,
        signed.body.accessToken,
        { roleId: roleB.id, scope: 'ORGANIZATION' },
      )
    ).status,
  ).toBe(403); // self modifications always denied
  expect(
    (
      await authenticated(`/organizations/${a.id}/users`, signed.body.accessToken, {
        name: 'Cross',
        email: `${randomUUID()}@example.test`,
        branchIds: [storeB.id],
      })
    ).status,
  ).toBe(404);
  expect(
    (await authRequest('/context', { organizationId: b.id }, { token: signed.body.accessToken }))
      .status,
  ).toBe(403);
});
it('OWN, BRANCH and BRANCH_SET filter SQL before pagination and ORGANIZATION explicitly reaches future branches', async () => {
  const org = await organization();
  const a = await branch(org.id, 'A');
  const b = await branch(org.id, 'B');
  const c = await branch(org.id, 'C');
  const own = await credentialUser(org.id, [a.id]);
  const manager = await credentialUser(org.id, [a.id, b.id]);
  const multi = await credentialUser(org.id, [a.id, b.id, c.id]);
  const director = await credentialUser(org.id);
  await assign(org.id, own.id, 'SELLER', 'OWN');
  await assign(org.id, manager.id, 'SALES_MANAGER', 'BRANCH', [a.id]);
  await assign(org.id, multi.id, 'SALES_MANAGER', 'BRANCH_SET', [a.id, b.id]);
  await assign(org.id, director.id, 'DIRECTOR', 'ORGANIZATION');
  const ownLogin = await login(own.user.email);
  const ownList = memberListResponseSchema.parse(
    await (await authenticated(`/organizations/${org.id}/users`, ownLogin.body.accessToken)).json(),
  );
  expect(ownList.data.map((row) => row.id)).toEqual([own.id]);
  const managerLogin = await login(manager.user.email);
  const branchList = branchListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/branches`, managerLogin.body.accessToken)
    ).json(),
  );
  expect(branchList.data.map((row) => row.id)).toEqual([a.id]);
  const members = memberListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/users`, managerLogin.body.accessToken)
    ).json(),
  );
  expect(members.data.every((row) => row.branchIds.every((id) => id === a.id))).toBe(true);
  const multiLogin = await login(multi.user.email);
  const stores = branchListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/branches`, multiLogin.body.accessToken)
    ).json(),
  );
  expect(stores.data.map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
  const filtered = branchListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/branches?limit=1`, multiLogin.body.accessToken)
    ).json(),
  );
  expect(filtered.data).toHaveLength(1);
  expect(filtered.pageInfo.hasNextPage).toBe(true);
  const future = await branch(org.id, 'FUTURE');
  const directorLogin = await login(director.user.email);
  const all = branchListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/branches`, directorLogin.body.accessToken)
    ).json(),
  );
  expect(all.data.map((row) => row.id)).toContain(future.id);
  expect(
    (
      await authenticated(`/organizations/${org.id}/branches`, managerLogin.body.accessToken, {
        name: 'Denied',
        code: 'DENIED',
      })
    ).status,
  ).toBe(403);
});
it('removing grant or membership branch immediately removes access with the same JWT', async () => {
  const org = await organization();
  const store = await branch(org.id);
  const user = await credentialUser(org.id, [store.id]);
  const grant = await assign(org.id, user.id, 'SELLER', 'BRANCH', [store.id]);
  const signed = await login(user.user.email);
  expect(
    (await authenticated(`/organizations/${org.id}/branches`, signed.body.accessToken)).status,
  ).toBe(200);
  const admin = await adminToken(org.id);
  expect(
    (
      await authenticated(
        `/organizations/${org.id}/memberships/${user.id}/roles/${grant}`,
        admin,
        undefined,
        'DELETE',
      )
    ).status,
  ).toBe(204);
  expect(
    (await authenticated(`/organizations/${org.id}/branches`, signed.body.accessToken)).status,
  ).toBe(403);
  await assign(org.id, user.id, 'SELLER', 'BRANCH', [store.id]);
  await db().branch.update({ where: { id: store.id }, data: { active: false } });
  expect(
    (await authenticated(`/organizations/${org.id}/branches`, signed.body.accessToken)).status,
  ).toBe(403);
});
it('roles without permissions fail closed and organization admin does not inherit platform creation', async () => {
  const org = await organization();
  const user = await credentialUser(org.id);
  const signed = await login(user.user.email);
  expect((await authenticated(`/organizations/${org.id}`, signed.body.accessToken)).status).toBe(
    403,
  );
  await assign(org.id, user.id, 'ADMIN', 'ORGANIZATION');
  expect((await authenticated(`/organizations/${org.id}`, signed.body.accessToken)).status).toBe(
    200,
  );
  expect(
    (
      await authenticated('/organizations', signed.body.accessToken, {
        name: 'Forbidden global creation',
      })
    ).status,
  ).toBe(403);
});
it('role management blocks self elevation, over-delegation, foreign roles/memberships, ALL and extra fields', async () => {
  const org = await organization();
  const other = await organization();
  const manager = await credentialUser(org.id);
  const target = await credentialUser(org.id);
  const foreign = await credentialUser(other.id);
  await assign(org.id, manager.id, 'DIRECTOR', 'ORGANIZATION');
  const signed = await login(manager.user.email);
  const admin = await tenantRole(org.id, 'ADMIN');
  const viewer = await tenantRole(org.id, 'VIEWER');
  const foreignRole = await tenantRole(other.id, 'VIEWER');
  const route = `/organizations/${org.id}/memberships/${target.id}/roles`;
  expect(
    (
      await authenticated(route, signed.body.accessToken, {
        roleId: admin.id,
        scope: 'ORGANIZATION',
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticated(
        `/organizations/${org.id}/memberships/${manager.id}/roles`,
        signed.body.accessToken,
        { roleId: viewer.id, scope: 'ORGANIZATION' },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticated(route, signed.body.accessToken, {
        roleId: foreignRole.id,
        scope: 'ORGANIZATION',
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await authenticated(
        `/organizations/${org.id}/memberships/${foreign.id}/roles`,
        signed.body.accessToken,
        { roleId: viewer.id, scope: 'ORGANIZATION' },
      )
    ).status,
  ).toBe(404);
  expect(
    (await authenticated(route, signed.body.accessToken, { roleId: viewer.id, scope: 'ALL' }))
      .status,
  ).toBe(400);
  expect(
    (
      await authenticated(route, signed.body.accessToken, {
        roleId: viewer.id,
        scope: 'ORGANIZATION',
        organizationId: other.id,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await authenticated(route, signed.body.accessToken, {
        roleId: viewer.id,
        scope: 'ORGANIZATION',
      })
    ).status,
  ).toBe(201);
});
it('permission and scope from separate roles cannot be combined into broader read or delegation', async () => {
  const org = await organization();
  const a = await branch(org.id, 'A');
  const b = await branch(org.id, 'B');
  const actor = await credentialUser(org.id, [a.id, b.id]);
  const target = await credentialUser(org.id, [a.id, b.id]);
  await assign(org.id, actor.id, 'SELLER', 'BRANCH', [a.id]);
  const usersManage = await db().permission.findUniqueOrThrow({ where: { code: 'users.manage' } });
  const restrictedManager = await db().role.create({
    data: {
      organizationId: org.id,
      code: 'GRANT_MANAGER',
      name: 'Grant manager',
      description: 'Synthetic policy fixture',
    },
  });
  await db().rolePermission.create({
    data: { organizationId: org.id, roleId: restrictedManager.id, permissionId: usersManage.id },
  });
  await assign(org.id, actor.id, 'GRANT_MANAGER', 'ORGANIZATION');
  const signed = await login(actor.user.email);
  const response = branchListResponseSchema.parse(
    await (
      await authenticated(`/organizations/${org.id}/branches`, signed.body.accessToken)
    ).json(),
  );
  expect(response.data.map((row) => row.id)).toEqual([a.id]);
  const seller = await tenantRole(org.id, 'SELLER');
  expect(
    (
      await authenticated(
        `/organizations/${org.id}/memberships/${target.id}/roles`,
        signed.body.accessToken,
        { roleId: seller.id, scope: 'ORGANIZATION' },
      )
    ).status,
  ).toBe(403);
});
it('concurrent duplicate role assignment is protected by unique constraints', async () => {
  const org = await organization();
  const target = await credentialUser(org.id);
  const role = await tenantRole(org.id, 'VIEWER');
  const results = await Promise.all([
    request(`/organizations/${org.id}/memberships/${target.id}/roles`, {
      roleId: role.id,
      scope: 'OWN',
    }),
    request(`/organizations/${org.id}/memberships/${target.id}/roles`, {
      roleId: role.id,
      scope: 'OWN',
    }),
  ]);
  expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
});
it('database rejects cross-tenant roles, unauthorized grant branches, platform-in-role and malformed scope cardinality', async () => {
  const a = await organization();
  const b = await organization();
  const storeA = await branch(a.id);
  const memberA = await credentialUser(a.id, [storeA.id]);
  const memberB = await credentialUser(b.id);
  const roleA = await tenantRole(a.id, 'SELLER');
  const roleB = await tenantRole(b.id, 'SELLER');
  await expect(
    db().userRole.create({
      data: { organizationId: a.id, membershipId: memberB.id, roleId: roleA.id, scope: 'OWN' },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().userRole.create({
      data: { organizationId: a.id, membershipId: memberA.id, roleId: roleB.id, scope: 'OWN' },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  await expect(
    db().userRole.create({
      data: { organizationId: a.id, membershipId: memberA.id, roleId: roleA.id, scope: 'ALL' },
    }),
  ).rejects.toThrow();
  await expect(
    db().userRole.create({
      data: {
        organizationId: a.id,
        membershipId: memberA.id,
        roleId: roleA.id,
        scope: 'BRANCH',
        scopeKey: 'a'.repeat(64),
      },
    }),
  ).rejects.toThrow();
  const permission = await db().permission.findUniqueOrThrow({
    where: { code: 'organizations.create' },
  });
  await expect(
    db().rolePermission.create({
      data: { organizationId: a.id, roleId: roleA.id, permissionId: permission.id },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  const grant = await assign(a.id, memberA.id, 'SELLER', 'BRANCH', [storeA.id]);
  const unassigned = await branch(a.id, 'UNASSIGNED');
  await expect(
    db().userRoleBranch.create({
      data: {
        organizationId: a.id,
        userRoleId: grant,
        membershipId: memberB.id,
        branchId: unassigned.id,
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('Redis login and refresh limits return 429/Retry-After and do not trust spoofed proxy headers', async () => {
  const redis = new Redis({
    host: environment['REDIS_HOST'],
    port: Number(environment['REDIS_PORT']),
    password: environment['REDIS_PASSWORD'],
    lazyConnect: true,
  });
  await redis.connect();
  try {
    for (const kind of ['login', 'refresh'] as const) {
      const key = `auth:rate:${kind}:ip:${createHash('sha256').update('127.0.0.1').digest('hex')}`;
      await redis.set(key, '1000', 'PX', 5000);
      const response = await fetch(url + '/api/v1/auth/' + kind, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.1',
        },
        body: JSON.stringify(
          kind === 'login'
            ? { email: 'admin.demo@example.test', password: environment['SEED_ADMIN_PASSWORD'] }
            : {},
        ),
      });
      expect(response.status).toBe(429);
      expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
      await redis.del(key);
    }
  } finally {
    await redis.quit();
  }
});
it('Redis failure closes authentication throttling with 503, while liveness remains truthful', async () => {
  await compose('pause', 'redis');
  try {
    const response = await authRequest('/login', {
      email: 'admin.demo@example.test',
      password: environment['SEED_ADMIN_PASSWORD'],
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('code', 'AUTH_UNAVAILABLE');
    expect((await fetch(url + '/health/live')).status).toBe(200);
  } finally {
    await compose('unpause', 'redis');
  }
  await until(
    async () => (await fetch(url + '/health/ready')).status === 200,
    'Redis auth recovery',
  );
});
it('seed remains idempotent for roles, permissions, grants and password, without resetting changed credentials', async () => {
  const demo = await db().user.findUniqueOrThrow({ where: { email: 'admin.demo@example.test' } });
  const before = {
    roles: await db().role.count(),
    permissions: await db().permission.count(),
    grants: await db().userRole.count(),
    hash: demo.passwordHash,
  };
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], { env: environment });
  const after = await db().user.findUniqueOrThrow({ where: { id: demo.id } });
  expect({
    roles: await db().role.count(),
    permissions: await db().permission.count(),
    grants: await db().userRole.count(),
    hash: after.passwordHash,
  }).toEqual(before);
});
it('OpenAPI specifies Bearer on administrative routes and logs contain no credentials or tokens', async () => {
  const document: unknown = await (await fetch(url + '/docs/openapi.json')).json();
  expect(document).toHaveProperty('components.securitySchemes.bearer');
  expect(document).toHaveProperty('paths./api/v1/organizations.post.security');
  expect(document).toHaveProperty('paths./api/v1/auth/login.post.requestBody');
  const signed = await login();
  const logs = children.flatMap((child) => child.logs).join('');
  expect(logs).not.toContain(signed.body.accessToken);
  expect(logs).not.toContain(signed.cookie);
  expect(logs).not.toContain(environment['SEED_ADMIN_PASSWORD']);
  expect(logs).not.toContain(environment['JWT_SECRET']);
  expect(logs).not.toContain(environment['DATABASE_URL']);
  expect(logs).not.toContain('$argon2id$');
});

it('scope cardinality remains enforced when moving a branch between grants directly in PostgreSQL', async () => {
  const org = await organization();
  const store = await branch(org.id);
  const member = await credentialUser(org.id, [store.id]);
  const first = await assign(org.id, member.id, 'SELLER', 'BRANCH', [store.id]);
  const second = await assign(org.id, member.id, 'SALES_MANAGER', 'BRANCH_SET', [store.id]);
  await expect(
    db().$transaction(async (transaction) => {
      await transaction.userRoleBranch.deleteMany({ where: { userRoleId: second } });
      await transaction.userRoleBranch.update({
        where: {
          organizationId_userRoleId_branchId: {
            organizationId: org.id,
            userRoleId: first,
            branchId: store.id,
          },
        },
        data: { userRoleId: second },
      });
    }),
  ).rejects.toThrow();
  expect(await db().userRoleBranch.count({ where: { userRoleId: first } })).toBe(1);
  expect(await db().userRoleBranch.count({ where: { userRoleId: second } })).toBe(1);
});
it('session context and refresh predecessor cannot point to a different identity or family', async () => {
  const a = await organization();
  const b = await organization();
  const userA = await credentialUser(a.id);
  const userB = await credentialUser(b.id);
  await expect(
    db().session.create({
      data: {
        userId: userA.user.id,
        membershipId: userB.id,
        securityVersion: 0,
        expiresAt: new Date(Date.now() + 60000),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
  const one = await login(userA.user.email);
  const two = await login(userB.user.email);
  const predecessor = await db().refreshToken.findFirstOrThrow({
    where: { sessionId: sessionId(one.body.accessToken) },
  });
  await expect(
    db().refreshToken.create({
      data: {
        sessionId: sessionId(two.body.accessToken),
        predecessorId: predecessor.id,
        tokenHash: randomBytes(32).toString('hex'),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
it('the IP-plus-email login limit normalizes identity and is atomic under concurrent attempts', async () => {
  const redis = new Redis({
    host: environment['REDIS_HOST'],
    port: Number(environment['REDIS_PORT']),
    password: environment['REDIS_PASSWORD'],
    lazyConnect: true,
  });
  await redis.connect();
  const email = `${randomUUID()}@example.test`;
  const key = `auth:rate:login:identity:${createHash('sha256').update(`127.0.0.1:${email}`).digest('hex')}`;
  try {
    await redis.set(key, '499', 'PX', 300000);
    const responses = await Promise.all([
      authRequest('/login', { email: email.toUpperCase(), password: 'Invalid password' }),
      authRequest('/login', { email: ` ${email} `, password: 'Invalid password' }),
    ]);
    expect(responses.map((row) => row.status).sort()).toEqual([401, 429]);
    expect(await redis.get(key)).toBe('501');
  } finally {
    await redis.del(key);
    await redis.quit();
  }
});

it('password change racing login and refresh never leaves an old-credential session usable', async () => {
  const org = await organization();
  const member = await credentialUser(org.id);
  const current = await login(member.user.email);
  const second = await login(member.user.email);
  const newPassword = randomBytes(24).toString('base64url');
  const [changed, concurrentLogin, concurrentRefresh] = await Promise.all([
    authRequest(
      '/change-password',
      { currentPassword: environment['SEED_ADMIN_PASSWORD'], newPassword },
      { token: current.body.accessToken },
    ),
    authRequest('/login', {
      email: member.user.email,
      password: environment['SEED_ADMIN_PASSWORD'],
    }),
    authRequest('/refresh', {}, { cookie: second.cookie }),
  ]);
  expect(changed.status).toBe(204);
  for (const response of [concurrentLogin, concurrentRefresh]) {
    expect([200, 401]).toContain(response.status);
    if (response.status === 200) {
      const issued = authResponseSchema.parse(await response.json());
      expect(
        (await authRequest('/me', {}, { token: issued.accessToken, method: 'GET' })).status,
      ).toBe(401);
    }
  }
  expect(
    (await authRequest('/me', {}, { token: current.body.accessToken, method: 'GET' })).status,
  ).toBe(401);
  expect((await login(member.user.email, newPassword)).body.user.id).toBe(member.user.id);
});

let phoneSequence = 0;
function syntheticPhone() {
  return '+5511' + String(++phoneSequence).padStart(8, '0');
}
async function commercialFixture() {
  const org = await organization('Commercial integration');
  const a = await branch(org.id, 'A');
  const b = await branch(org.id, 'B');
  const c = await branch(org.id, 'C');
  const owner = await credentialUser(org.id, [a.id, b.id, c.id]);
  const other = await credentialUser(org.id, [a.id, b.id, c.id]);
  const token = await adminToken(org.id);
  return { org, a, b, c, owner, other, token };
}
async function companyFixture(
  f: Awaited<ReturnType<typeof commercialFixture>>,
  branchId = f.a.id,
  ownerMembershipId = f.owner.id,
) {
  const r = await authenticated('/companies', f.token, {
    name: 'Synthetic company',
    branchId,
    ownerMembershipId,
    document: 'GB-' + randomUUID(),
  });
  expect(r.status).toBe(201);
  return companyResponseSchema.parse(await r.json());
}
async function contactFixture(
  f: Awaited<ReturnType<typeof commercialFixture>>,
  overrides: Record<string, unknown> = {},
) {
  const r = await authenticated('/contacts', f.token, {
    name: 'Synthetic contact',
    phone: syntheticPhone(),
    branchId: f.a.id,
    ownerMembershipId: f.owner.id,
    ...overrides,
  });
  expect(r.status).toBe(201);
  return contactResponseSchema.parse(await r.json());
}
it('commercial CRUD creates normalized contact, company, tags and preserves archive relationships', async () => {
  const f = await commercialFixture();
  const company = await companyFixture(f);
  const t = await authenticated('/tags', f.token, { name: ' VIP ', variant: 'primary' });
  expect(t.status).toBe(201);
  const tag = tagResponseSchema.parse(await t.json());
  const row = await contactFixture(f, {
    phone: '+44 (20) 1234-5678',
    email: ' CUSTOMER@EXAMPLE.TEST ',
    document: 'US-123.456',
    companyId: company.id,
    tagIds: [tag.id],
    notes: '<script>literal text</script>',
  });
  expect(row.email).toBe('customer@example.test');
  expect(row.company?.id).toBe(company.id);
  expect(row.tags[0]?.id).toBe(tag.id);
  const stored = await db().contact.findUniqueOrThrow({ where: { id: row.id } });
  expect(stored.normalizedPhone).toBe('+442012345678');
  expect(stored.normalizedDocument).toBe('US123456');
  expect(stored.createdByMembershipId).not.toBe(f.owner.id);
  const changed = await authenticated(
    `/contacts/${row.id}`,
    f.token,
    { name: 'Changed', expectedVersion: row.version },
    'PATCH',
  );
  expect(changed.status).toBe(200);
  const edited = contactResponseSchema.parse(await changed.json());
  expect(edited.version).toBe(2);
  expect(edited.tags[0]?.id).toBe(tag.id);
  const archived = await authenticated(
    `/contacts/${row.id}`,
    f.token,
    { expectedVersion: edited.version },
    'DELETE',
  );
  expect(archived.status).toBe(200);
  expect(contactResponseSchema.parse(await archived.json()).active).toBe(false);
  expect(await db().contactTag.count({ where: { contactId: row.id } })).toBe(1);
});
it('commercial lists filter and keyset paginate before returning safe projections', async () => {
  const f = await commercialFixture();
  const company = await companyFixture(f);
  await contactFixture(f, { name: 'Paged alpha', companyId: company.id, source: 'REFERRAL' });
  await contactFixture(f, { name: 'Paged beta', companyId: company.id, source: 'REFERRAL' });
  await contactFixture(f, { name: 'Other' });
  const q = `/contacts?limit=1&sort=name&direction=asc&search=Paged&companyId=${company.id}&source=REFERRAL&branchId=${f.a.id}&ownerMembershipId=${f.owner.id}&active=true`;
  const first = contactListResponseSchema.parse(await (await authenticated(q, f.token)).json());
  expect(first.data[0]?.name).toBe('Paged alpha');
  expect(first.pageInfo.hasNextPage).toBe(true);
  const second = contactListResponseSchema.parse(
    await (
      await authenticated(
        q + '&cursor=' + encodeURIComponent(first.pageInfo.nextCursor ?? ''),
        f.token,
      )
    ).json(),
  );
  expect(second.data[0]?.name).toBe('Paged beta');
  expect(second.pageInfo.hasNextPage).toBe(false);
  expect(JSON.stringify(first)).not.toMatch(
    /passwordHash|normalizedPhone|createdByMembershipId|securityVersion|permissions/,
  );
  expect((await authenticated('/contacts?limit=101', f.token)).status).toBe(400);
  expect((await authenticated('/contacts?sort=passwordHash', f.token)).status).toBe(400);
  expect((await authenticated('/contacts?cursor=bad', f.token)).status).toBe(400);
});
it('phone uniqueness is tenant scoped, handles concurrent creation and retains archived identity', async () => {
  const a = await commercialFixture();
  const b = await commercialFixture();
  const phone = syntheticPhone();
  const payload = { name: 'Race', phone, branchId: a.a.id, ownerMembershipId: a.owner.id };
  const results = await Promise.all([
    authenticated('/contacts', a.token, payload),
    authenticated('/contacts', a.token, payload),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  const row = contactResponseSchema.parse(await results.find((r) => r.status === 201)?.json());
  expect(
    (
      await authenticated(
        `/contacts/${row.id}`,
        a.token,
        { expectedVersion: row.version },
        'DELETE',
      )
    ).status,
  ).toBe(200);
  expect((await authenticated('/contacts', a.token, payload)).status).toBe(409);
  await contactFixture(b, { phone });
});
it('company and contact documents dedupe per tenant while shared emails remain legal', async () => {
  const f = await commercialFixture();
  const first = await contactFixture(f, { document: 'US-456.789', email: 'shared@example.test' });
  await contactFixture(f, { email: 'shared@example.test' });
  expect(
    (
      await authenticated('/contacts', f.token, {
        name: 'Duplicate doc',
        phone: syntheticPhone(),
        document: 'us456789',
        branchId: f.a.id,
        ownerMembershipId: f.owner.id,
      })
    ).status,
  ).toBe(409);
  const company = await companyFixture(f);
  expect(
    (
      await authenticated('/companies', f.token, {
        name: 'Duplicate',
        branchId: f.a.id,
        ownerMembershipId: f.owner.id,
        document: company.document,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await authenticated(
        `/contacts/${first.id}`,
        f.token,
        { phone: syntheticPhone(), expectedVersion: 0 },
        'PATCH',
      )
    ).status,
  ).toBe(400);
});
it('tag normalization dedupes concurrent names and restricts variants', async () => {
  const f = await commercialFixture();
  const results = await Promise.all([
    authenticated('/tags', f.token, { name: ' VIP  account ' }),
    authenticated('/tags', f.token, { name: 'vip account' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  const tag = tagResponseSchema.parse(await results.find((r) => r.status === 201)?.json());
  expect(
    (
      await authenticated(
        `/tags/${tag.id}`,
        f.token,
        { name: 'Renamed', expectedVersion: tag.version },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect(
    (await authenticated(`/tags/${tag.id}`, f.token, { expectedVersion: 2 }, 'DELETE')).status,
  ).toBe(200);
  expect(
    (
      await authenticated('/tags', f.token, {
        name: 'Unsafe',
        variant: 'red; background:url(evil)',
      })
    ).status,
  ).toBe(400);
});
it.each(['branch', 'owner', 'company', 'tag'] as const)(
  'rejects cross-tenant %s association atomically in API and PostgreSQL',
  async (kind) => {
    const a = await commercialFixture();
    const b = await commercialFixture();
    const company = await companyFixture(b);
    const tag = tagResponseSchema.parse(
      await (await authenticated('/tags', b.token, { name: 'Foreign' })).json(),
    );
    const payload = {
      name: 'Foreign relationship',
      phone: syntheticPhone(),
      branchId: kind === 'branch' ? b.a.id : a.a.id,
      ownerMembershipId: kind === 'owner' ? b.owner.id : a.owner.id,
      companyId: kind === 'company' ? company.id : null,
      tagIds: kind === 'tag' ? [tag.id] : [],
    };
    const response = await authenticated('/contacts', a.token, payload);
    expect([403, 404]).toContain(response.status);
    expect(await db().contact.count({ where: { organizationId: a.org.id } })).toBe(0);
    if (kind !== 'tag') {
      const actor = await db().organizationMembership.findFirstOrThrow({
        where: { organizationId: a.org.id, user: { email: 'admin.demo@example.test' } },
      });
      await expect(
        db().contact.create({
          data: {
            organizationId: a.org.id,
            name: 'Direct cross tenant',
            phone: payload.phone,
            normalizedPhone: payload.phone,
            branchId: payload.branchId,
            ownerMembershipId: payload.ownerMembershipId,
            companyId: payload.companyId,
            createdByMembershipId: actor.id,
            updatedByMembershipId: actor.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    } else {
      const row = await contactFixture(a);
      await expect(
        db().contactTag.create({
          data: { organizationId: a.org.id, contactId: row.id, tagId: tag.id },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    }
  },
);
it('cross-tenant IDs never permit reads, mutations or enumeration', async () => {
  const a = await commercialFixture();
  const b = await commercialFixture();
  const row = await contactFixture(b);
  const company = await companyFixture(b);
  for (const path of [`/contacts/${row.id}`, `/companies/${company.id}`]) {
    expect((await authenticated(path, a.token)).status).toBe(404);
    expect(
      (await authenticated(path, a.token, { name: 'Attack', expectedVersion: 1 }, 'PATCH')).status,
    ).toBe(404);
    expect((await authenticated(path, a.token, { expectedVersion: 1 }, 'DELETE')).status).toBe(404);
  }
  expect(
    contactListResponseSchema.parse(await (await authenticated('/contacts', a.token)).json()).data,
  ).toEqual([]);
  expect(
    companyListResponseSchema.parse(await (await authenticated('/companies', a.token)).json()).data,
  ).toEqual([]);
  expect(
    tagListResponseSchema.parse(await (await authenticated('/tags', a.token)).json()).data,
  ).toEqual([]);
});
it.each(['OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION'] as const)(
  'commercial scope %s protects lists, lookups, mutations and company-linked contact lists',
  async (scope) => {
    const f = await commercialFixture();
    const company = await companyFixture(f);
    const own = await contactFixture(f, { companyId: company.id });
    const companySame = await companyFixture(f, f.a.id, f.other.id);
    const companyB = await companyFixture(f, f.b.id, f.other.id);
    const companyC = await companyFixture(f, f.c.id, f.other.id);
    const sameBranch = await contactFixture(f, {
      ownerMembershipId: f.other.id,
      companyId: company.id,
    });
    const branchB = await contactFixture(f, {
      branchId: f.b.id,
      ownerMembershipId: f.other.id,
      companyId: company.id,
    });
    const branchC = await contactFixture(f, {
      branchId: f.c.id,
      ownerMembershipId: f.other.id,
      companyId: company.id,
    });
    await assign(
      f.org.id,
      f.owner.id,
      scope === 'ORGANIZATION' ? 'DIRECTOR' : 'SELLER',
      scope,
      scope === 'BRANCH' ? [f.a.id] : scope === 'BRANCH_SET' ? [f.a.id, f.b.id] : [],
    );
    const signed = await login(f.owner.user.email);
    const token = signed.body.accessToken;
    const expected =
      scope === 'OWN'
        ? [own.id]
        : scope === 'BRANCH'
          ? [own.id, sameBranch.id]
          : scope === 'BRANCH_SET'
            ? [own.id, sameBranch.id, branchB.id]
            : [own.id, sameBranch.id, branchB.id, branchC.id];
    const list = contactListResponseSchema.parse(
      await (await authenticated(`/contacts?companyId=${company.id}&limit=100`, token)).json(),
    );
    expect(list.data.map((row) => row.id).sort()).toEqual(expected.sort());
    const expectedCompanies =
      scope === 'OWN'
        ? [company.id]
        : scope === 'BRANCH'
          ? [company.id, companySame.id]
          : scope === 'BRANCH_SET'
            ? [company.id, companySame.id, companyB.id]
            : [company.id, companySame.id, companyB.id, companyC.id];
    const companies = companyListResponseSchema.parse(
      await (await authenticated('/companies?limit=100', token)).json(),
    );
    expect(companies.data.map((row) => row.id).sort()).toEqual(expectedCompanies.sort());
    for (const row of [company, companySame, companyB, companyC]) {
      const allowed = expectedCompanies.includes(row.id);
      expect((await authenticated(`/companies/${row.id}`, token)).status).toBe(allowed ? 200 : 404);
      expect(
        (
          await authenticated(
            `/companies/${row.id}`,
            token,
            { notes: 'Scoped company edit', expectedVersion: row.version },
            'PATCH',
          )
        ).status,
      ).toBe(allowed ? 200 : 404);
    }
    for (const row of [own, sameBranch, branchB, branchC]) {
      const allowed = expected.includes(row.id);
      expect((await authenticated(`/contacts/${row.id}`, token)).status).toBe(allowed ? 200 : 404);
      expect(
        (
          await authenticated(
            `/contacts/${row.id}`,
            token,
            { notes: 'Authorized edit', expectedVersion: row.version },
            'PATCH',
          )
        ).status,
      ).toBe(allowed ? 200 : 404);
    }
    const branches = assignmentListResponseSchema.parse(
      await (await authenticated('/contacts/assignment-branches?action=create', token)).json(),
    );
    expect(branches.data.map((row) => row.id).sort()).toEqual(
      (scope === 'BRANCH'
        ? [f.a.id]
        : scope === 'BRANCH_SET'
          ? [f.a.id, f.b.id]
          : [f.a.id, f.b.id, f.c.id]
      ).sort(),
    );
    const owners = assignmentListResponseSchema.parse(
      await (
        await authenticated(`/contacts/assignment-owners?action=create&branchId=${f.a.id}`, token)
      ).json(),
    );
    if (scope === 'OWN') expect(owners.data.map((row) => row.id)).toEqual([f.owner.id]);
  },
);
it('action-specific grants do not borrow broad scopes and OWNER cannot transfer without assign', async () => {
  const f = await commercialFixture();
  await assign(f.org.id, f.owner.id, 'SELLER', 'OWN');
  const broad = await db().role.create({
    data: {
      organizationId: f.org.id,
      code: 'COMPANY_ONLY',
      name: 'Company only',
      description: 'Fixture',
    },
  });
  const permission = await db().permission.findUniqueOrThrow({ where: { code: 'companies.read' } });
  await db().rolePermission.create({
    data: { organizationId: f.org.id, roleId: broad.id, permissionId: permission.id },
  });
  await db().userRole.create({
    data: {
      organizationId: f.org.id,
      membershipId: f.owner.id,
      roleId: broad.id,
      scope: 'ORGANIZATION',
    },
  });
  const own = await contactFixture(f);
  const other = await contactFixture(f, { ownerMembershipId: f.other.id });
  const signed = await login(f.owner.user.email);
  expect((await authenticated(`/contacts/${other.id}`, signed.body.accessToken)).status).toBe(404);
  expect(
    (
      await authenticated(
        `/contacts/${own.id}`,
        signed.body.accessToken,
        { branchId: f.b.id, expectedVersion: own.version },
        'PATCH',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticated('/contacts', signed.body.accessToken, {
        name: 'Assign other',
        phone: syntheticPhone(),
        branchId: f.a.id,
        ownerMembershipId: f.other.id,
      })
    ).status,
  ).toBe(403);
});
it('company visibility and contact visibility are independent; joins cannot reveal hidden companies', async () => {
  const f = await commercialFixture();
  const company = await companyFixture(f, f.a.id, f.other.id);
  const contact = await contactFixture(f, { companyId: company.id });
  await assign(f.org.id, f.owner.id, 'SELLER', 'OWN');
  const signed = await login(f.owner.user.email);
  const read = contactResponseSchema.parse(
    await (await authenticated(`/contacts/${contact.id}`, signed.body.accessToken)).json(),
  );
  expect(read.company).toBeNull();
  expect((await authenticated(`/companies/${company.id}`, signed.body.accessToken)).status).toBe(
    404,
  );
  expect(
    (await authenticated(`/contacts?companyId=${company.id}`, signed.body.accessToken)).status,
  ).toBe(404);
  expect(
    (
      await authenticated('/contacts', signed.body.accessToken, {
        name: 'Hidden company link',
        phone: syntheticPhone(),
        branchId: f.a.id,
        companyId: company.id,
      })
    ).status,
  ).toBe(404);
});
it('owner must remain linked to the branch and inactive assignments cannot create records', async () => {
  const f = await commercialFixture();
  const unlinked = await identity(f.org.id, []);
  expect(
    (
      await authenticated('/contacts', f.token, {
        name: 'Unlinked',
        phone: syntheticPhone(),
        branchId: f.a.id,
        ownerMembershipId: unlinked.id,
      })
    ).status,
  ).toBe(404);
  await db().organizationMembership.update({ where: { id: f.owner.id }, data: { active: false } });
  expect(
    (
      await authenticated('/companies', f.token, {
        name: 'Inactive owner',
        branchId: f.a.id,
        ownerMembershipId: f.owner.id,
      })
    ).status,
  ).toBe(404);
});
it('transaction rolls back contact and associations when any tag is invalid', async () => {
  const f = await commercialFixture();
  const tag = tagResponseSchema.parse(
    await (await authenticated('/tags', f.token, { name: 'Valid' })).json(),
  );
  expect(
    (
      await authenticated('/contacts', f.token, {
        name: 'Rollback',
        phone: syntheticPhone(),
        branchId: f.a.id,
        ownerMembershipId: f.owner.id,
        tagIds: [tag.id, randomUUID()],
      })
    ).status,
  ).toBe(404);
  expect(await db().contact.count({ where: { organizationId: f.org.id } })).toBe(0);
  expect(await db().contactTag.count({ where: { organizationId: f.org.id } })).toBe(0);
});
it('concurrent contact updates do not lose writes or mix tag sets', async () => {
  const f = await commercialFixture();
  const row = await contactFixture(f);
  const replies = await Promise.all([
    authenticated(
      `/contacts/${row.id}`,
      f.token,
      { name: 'A', expectedVersion: row.version },
      'PATCH',
    ),
    authenticated(
      `/contacts/${row.id}`,
      f.token,
      { name: 'B', expectedVersion: row.version },
      'PATCH',
    ),
  ]);
  expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await db().contact.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(2);
});
it('permissions deny anonymous and VIEWER mutations while allowing bounded reads', async () => {
  const f = await commercialFixture();
  await assign(f.org.id, f.owner.id, 'VIEWER', 'ORGANIZATION');
  const signed = await login(f.owner.user.email);
  for (const resource of ['contacts', 'companies', 'tags']) {
    expect((await fetch(url + '/api/v1/' + resource)).status).toBe(401);
    expect((await authenticated('/' + resource, signed.body.accessToken)).status).toBe(200);
    expect((await authenticated('/' + resource, signed.body.accessToken, {})).status).toBe(403);
  }
});
it('commercial Swagger schemas expose strict contracts, filters and no internal columns', async () => {
  const document: unknown = await (await fetch(url + '/docs/openapi.json')).json();
  expect(document).toHaveProperty('paths./api/v1/contacts.post');
  expect(document).toHaveProperty('paths./api/v1/companies/{id}.patch');
  expect(document).toHaveProperty('paths./api/v1/tags/{id}.delete');
  expect(document).toHaveProperty(
    'paths./api/v1/contacts.post.requestBody.content.application/json.schema.additionalProperties',
    false,
  );
  expect(JSON.stringify(document)).not.toMatch(
    /normalizedPhone|passwordHash|updatedByMembershipId/,
  );
});
it('default tenant keyset query uses its index with a representative synthetic dataset', async () => {
  const f = await commercialFixture();
  const actor = await db().organizationMembership.findFirstOrThrow({
    where: { organizationId: f.org.id, user: { email: 'admin.demo@example.test' } },
  });
  await db().contact.createMany({
    data: Array.from({ length: 2000 }, (_, index) => ({
      organizationId: f.org.id,
      branchId: f.a.id,
      ownerMembershipId: f.owner.id,
      name: `Performance fixture ${index}`,
      phone: '+1212' + String(index).padStart(8, '0'),
      normalizedPhone: '+1212' + String(index).padStart(8, '0'),
      createdByMembershipId: actor.id,
      updatedByMembershipId: actor.id,
      createdAt: new Date(1700000000000 + index),
    })),
  });
  await db().$executeRaw`ANALYZE contacts`;
  const plans = await db().$queryRaw<
    { 'QUERY PLAN': unknown }[]
  >`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,name FROM contacts WHERE organization_id=${f.org.id}::uuid ORDER BY created_at DESC,id DESC LIMIT 26`;
  expect(JSON.stringify(plans)).toContain('contacts_organization_id_created_at_id_idx');
  const list = contactListResponseSchema.parse(
    await (await authenticated('/contacts?limit=25', f.token)).json(),
  );
  expect(list.data).toHaveLength(25);
  expect(list.pageInfo.hasNextPage).toBe(true);
});
it('authorized assignment changes preserve minimal history atomically and reject stale changes', async () => {
  const f = await commercialFixture();
  const contact = await contactFixture(f);
  const company = await companyFixture(f);
  for (const [resource, record] of [
    ['contacts', contact],
    ['companies', company],
  ] as const) {
    const changed = await authenticated(
      `/${resource}/${record.id}`,
      f.token,
      { branchId: f.b.id, ownerMembershipId: f.other.id, expectedVersion: record.version },
      'PATCH',
    );
    expect(changed.status).toBe(200);
    const history =
      resource === 'contacts'
        ? await db().contactAssignmentHistory.findMany({ where: { contactId: record.id } })
        : await db().companyAssignmentHistory.findMany({ where: { companyId: record.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      organizationId: f.org.id,
      fromBranchId: f.a.id,
      toBranchId: f.b.id,
      fromOwnerMembershipId: f.owner.id,
      toOwnerMembershipId: f.other.id,
      recordVersion: 2,
    });
    expect(
      (
        await authenticated(
          `/${resource}/${record.id}`,
          f.token,
          { branchId: f.c.id, expectedVersion: 1 },
          'PATCH',
        )
      ).status,
    ).toBe(409);
  }
});
it('current authorization changes invalidate the commercial cache scope without changing permission codes', async () => {
  const f = await commercialFixture();
  const grantId = await assign(f.org.id, f.owner.id, 'SELLER', 'BRANCH_SET', [f.a.id, f.b.id]);
  const signed = await login(f.owner.user.email);
  const before = meResponseSchema.parse(
    await (await authenticated('/auth/me', signed.body.accessToken)).json(),
  );
  await db().userRoleBranch.deleteMany({
    where: { organizationId: f.org.id, userRoleId: grantId, branchId: f.b.id },
  });
  const after = meResponseSchema.parse(
    await (await authenticated('/auth/me', signed.body.accessToken)).json(),
  );
  expect(after.context?.permissions).toEqual(before.context?.permissions);
  expect(after.context?.cacheScopeKey).not.toEqual(before.context?.cacheScopeKey);
  expect(
    (
      await authenticated(
        `/companies/assignment-owners?action=create&branchId=${f.b.id}`,
        signed.body.accessToken,
      )
    ).status,
  ).toBe(403);
});

async function salesFixture() {
  const f = await commercialFixture();
  const result = await authenticated('/pipelines', f.token, {
    name: 'Sales ' + randomUUID(),
    stages: [
      { name: 'Entry', kind: 'OPEN' },
      { name: 'Negotiation', kind: 'OPEN' },
      { name: 'Won', kind: 'WON' },
      { name: 'Lost', kind: 'LOST' },
    ],
  });
  expect(result.status).toBe(201);
  const pipeline = pipelineResponseSchema.parse(await result.json());
  const entry = pipeline.stages[0],
    negotiation = pipeline.stages[1],
    won = pipeline.stages[2],
    lost = pipeline.stages[3];
  if (!entry || !negotiation || !won || !lost) throw new Error('Sales stages missing');
  return { ...f, pipeline, entry, negotiation, won, lost };
}
async function leadFixture(
  f: Awaited<ReturnType<typeof salesFixture>>,
  overrides: Record<string, unknown> = {},
) {
  const result = await authenticated('/leads', f.token, {
    name: 'Synthetic lead',
    phone: syntheticPhone(),
    companyName: 'Synthetic prospect',
    email: ' PROSPECT@EXAMPLE.TEST ',
    branchId: f.a.id,
    ownerMembershipId: f.owner.id,
    ...overrides,
  });
  expect(result.status).toBe(201);
  return leadResponseSchema.parse(await result.json());
}
async function opportunityFixture(
  f: Awaited<ReturnType<typeof salesFixture>>,
  overrides: Record<string, unknown> = {},
) {
  const result = await authenticated('/opportunities', f.token, {
    name: 'Synthetic deal',
    branchId: f.a.id,
    ownerMembershipId: f.owner.id,
    pipelineId: f.pipeline.id,
    stageId: f.entry.id,
    amount: '123.4567',
    ...overrides,
  });
  expect(result.status).toBe(201);
  return opportunityResponseSchema.parse(await result.json());
}
it('sales contracts reject mass assignment and safely document implemented routes', async () => {
  const f = await salesFixture();
  expect(
    (
      await authenticated('/leads', f.token, {
        name: 'Bad',
        branchId: f.a.id,
        organizationId: f.org.id,
      })
    ).status,
  ).toBe(400);
  const lead = await leadFixture(f);
  expect(lead.email).toBe('prospect@example.test');
  expect(JSON.stringify(lead)).not.toMatch(
    /conversionRequestHash|organizationId|createdByMembershipId/,
  );
  const docs: unknown = await (await fetch(url + '/docs/openapi.json')).json();
  expect(docs).toHaveProperty('paths./api/v1/leads/{id}/convert.post');
  expect(docs).toHaveProperty('paths./api/v1/opportunities/{id}/stage.post');
  expect(docs).toHaveProperty('paths./api/v1/pipelines/{id}/stages/reorder.post');
});
it('pipelines configure stable order, reject stale versions and preserve archived stages', async () => {
  const f = await salesFixture();
  const reordered = await authenticated(`/pipelines/${f.pipeline.id}/stages/reorder`, f.token, {
    expectedVersion: 1,
    stageIds: [f.negotiation.id, f.entry.id, f.won.id, f.lost.id],
  });
  expect(reordered.status).toBe(200);
  const updated = pipelineResponseSchema.parse(await reordered.json());
  expect(updated.version).toBe(2);
  expect(updated.stages[0]?.id).toBe(f.negotiation.id);
  expect(
    (
      await authenticated(
        `/pipelines/${f.pipeline.id}`,
        f.token,
        { name: 'Stale', expectedVersion: 1 },
        'PATCH',
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await authenticated(
        `/pipelines/${f.pipeline.id}/stages/${f.entry.id}`,
        f.token,
        { expectedVersion: 2, kind: 'WON' },
        'PATCH',
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await authenticated(
        `/pipelines/${f.pipeline.id}/stages/${f.entry.id}`,
        f.token,
        { expectedVersion: 2, active: false },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await authenticated(
        `/pipelines/${f.pipeline.id}/stages/${f.negotiation.id}`,
        f.token,
        { expectedVersion: 3, active: false },
        'PATCH',
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await authenticated('/opportunities', f.token, {
        name: 'Archived target',
        branchId: f.a.id,
        pipelineId: f.pipeline.id,
        stageId: f.entry.id,
      })
    ).status,
  ).toBe(404);
});
it('pipeline name uniqueness remains safe under concurrent creation', async () => {
  const f = await salesFixture(),
    input = { name: ' Same   pipeline ', stages: [{ name: 'Entry', kind: 'OPEN' }] };
  const results = await Promise.all([
    authenticated('/pipelines', f.token, input),
    authenticated('/pipelines', f.token, { ...input, name: 'same pipeline' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
});
it('qualified conversion creates customer/company/opportunity atomically and deduplicates concurrent retries', async () => {
  const f = await salesFixture(),
    lead = await leadFixture(f);
  expect(
    (
      await authenticated(`/leads/${lead.id}/convert`, f.token, {
        pipelineId: f.pipeline.id,
        stageId: f.entry.id,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await authenticated(
        `/leads/${lead.id}`,
        f.token,
        { status: 'QUALIFIED', expectedVersion: 1 },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  const input = {
    pipelineId: f.pipeline.id,
    stageId: f.entry.id,
    expectedVersion: 2,
    createContact: true,
    createCompany: true,
    amount: '350.2500',
  };
  await assign(f.org.id, f.other.id, 'DIRECTOR', 'ORGANIZATION', []);
  const secondToken = (await login(f.other.user.email)).body.accessToken;
  const results = await Promise.all([
    authenticated(`/leads/${lead.id}/convert`, f.token, input),
    authenticated(`/leads/${lead.id}/convert`, secondToken, input),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  const converted = await Promise.all(
    results.map(async (r) => conversionResponseSchema.parse(await r.json())),
  );
  expect(converted[0]?.opportunity.id).toBe(converted[1]?.opportunity.id);
  expect(converted[0]?.lead.status).toBe('CONVERTED');
  expect(converted[0]?.opportunity.amount).toBe('350.2500');
  expect(
    await db().opportunity.count({ where: { organizationId: f.org.id, leadId: lead.id } }),
  ).toBe(1);
  expect(await db().contact.count({ where: { organizationId: f.org.id } })).toBe(1);
  expect(await db().company.count({ where: { organizationId: f.org.id } })).toBe(1);
  expect(
    (await authenticated(`/leads/${lead.id}/convert`, f.token, { ...input, amount: '999' })).status,
  ).toBe(409);
  expect(
    (
      await authenticated(
        `/leads/${lead.id}`,
        f.token,
        { status: 'NEW', expectedVersion: 3 },
        'PATCH',
      )
    ).status,
  ).toBe(409);
});
it('conversion rolls back newly created company on a duplicate contact and permits explicit reuse', async () => {
  const f = await salesFixture(),
    existing = await contactFixture(f),
    lead = await leadFixture(f, { phone: existing.phone });
  await authenticated(
    `/leads/${lead.id}`,
    f.token,
    { status: 'QUALIFIED', expectedVersion: 1 },
    'PATCH',
  );
  const input = {
    pipelineId: f.pipeline.id,
    stageId: f.entry.id,
    expectedVersion: 2,
    createCompany: true,
    createContact: true,
  };
  expect((await authenticated(`/leads/${lead.id}/convert`, f.token, input)).status).toBe(409);
  expect(await db().company.count({ where: { organizationId: f.org.id } })).toBe(0);
  expect(await db().opportunity.count({ where: { organizationId: f.org.id } })).toBe(0);
  expect((await db().lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
  expect(
    (
      await authenticated(`/leads/${lead.id}/convert`, f.token, {
        ...input,
        createContact: false,
        contactId: existing.id,
      })
    ).status,
  ).toBe(200);
});
it('stage changes, close and reopen have atomic ordered history and decimal values', async () => {
  const f = await salesFixture(),
    record = await opportunityFixture(f);
  expect(record.amount).toBe('123.4567');
  expect(
    (
      await authenticated(`/opportunities/${record.id}/stage`, f.token, {
        stageId: f.lost.id,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(400);
  const moved = await authenticated(`/opportunities/${record.id}/stage`, f.token, {
    stageId: f.lost.id,
    expectedVersion: 1,
    reason: 'Customer declined',
  });
  expect(moved.status).toBe(200);
  const lost = opportunityResponseSchema.parse(await moved.json());
  expect(lost.status).toBe('LOST');
  expect(lost.closedAt).not.toBeNull();
  expect(lost.lostReason).toBe('Customer declined');
  expect(
    (
      await authenticated(`/opportunities/${record.id}/stage`, f.token, {
        stageId: f.won.id,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(409);
  const reopened = await authenticated(`/opportunities/${record.id}/stage`, f.token, {
    stageId: f.negotiation.id,
    expectedVersion: 2,
  });
  expect(reopened.status).toBe(200);
  expect(opportunityResponseSchema.parse(await reopened.json())).toMatchObject({
    status: 'OPEN',
    closedAt: null,
    lostReason: null,
    version: 3,
  });
  const history = stageHistoryListResponseSchema.parse(
    await (
      await authenticated(`/opportunities/${record.id}/stage-history?limit=2`, f.token)
    ).json(),
  );
  expect(history.data.map((row) => row.recordVersion)).toEqual([1, 2]);
  const next = stageHistoryListResponseSchema.parse(
    await (
      await authenticated(
        `/opportunities/${record.id}/stage-history?limit=2&cursor=${history.pageInfo.nextCursor}`,
        f.token,
      )
    ).json(),
  );
  expect(next.data[0]?.recordVersion).toBe(3);
});
it('concurrent opportunity movement commits only one history entry for an expected version', async () => {
  const f = await salesFixture(),
    record = await opportunityFixture(f);
  await assign(f.org.id, f.other.id, 'DIRECTOR', 'ORGANIZATION', []);
  const otherToken = (await login(f.other.user.email)).body.accessToken;
  const results = await Promise.all([
    authenticated(`/opportunities/${record.id}/stage`, f.token, {
      stageId: f.negotiation.id,
      expectedVersion: 1,
    }),
    authenticated(`/opportunities/${record.id}/stage`, otherToken, {
      stageId: f.won.id,
      expectedVersion: 1,
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db().opportunityStageHistory.count({ where: { opportunityId: record.id } })).toBe(2);
});
it('opportunity foreign keys reject cross-tenant links and stages from another pipeline', async () => {
  const a = await salesFixture(),
    b = await salesFixture(),
    record = await opportunityFixture(a);
  await expect(
    db().opportunity.update({ where: { id: record.id }, data: { stageId: b.entry.id } }),
  ).rejects.toThrow();
  const otherResult = await authenticated('/pipelines', a.token, {
    name: 'Another',
    stages: [{ name: 'Entry' }],
  });
  const other = pipelineResponseSchema.parse(await otherResult.json());
  const otherStage = other.stages[0];
  if (!otherStage) throw new Error('Other pipeline stage missing');
  await expect(
    db().opportunity.update({ where: { id: record.id }, data: { stageId: otherStage.id } }),
  ).rejects.toThrow();
  await expect(
    db().opportunity.update({ where: { id: record.id }, data: { status: 'WON' } }),
  ).rejects.toThrow();
  const lead = await leadFixture(a);
  await expect(
    db().lead.update({ where: { id: lead.id }, data: { branchId: b.a.id } }),
  ).rejects.toThrow();
  await expect(
    db().lead.update({ where: { id: lead.id }, data: { ownerMembershipId: b.owner.id } }),
  ).rejects.toThrow();
  await expect(
    db().lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED' } }),
  ).rejects.toThrow();
  expect((await authenticated(`/leads/${lead.id}`, b.token)).status).toBe(404);
  expect((await authenticated(`/opportunities/${record.id}`, b.token)).status).toBe(404);
  expect((await authenticated(`/pipelines/${a.pipeline.id}`, b.token)).status).toBe(404);
});
it.each(['OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION'] as const)(
  'sales scope %s filters before pagination and protects stage changes and conversion',
  async (scope) => {
    const f = await salesFixture();
    const own = await opportunityFixture(f),
      same = await opportunityFixture(f, { ownerMembershipId: f.other.id }),
      other = await opportunityFixture(f, { branchId: f.b.id, ownerMembershipId: f.other.id }),
      third = await opportunityFixture(f, { branchId: f.c.id, ownerMembershipId: f.other.id });
    const lead = await leadFixture(f),
      otherLead = await leadFixture(f, { branchId: f.c.id, ownerMembershipId: f.other.id });
    await authenticated(
      `/leads/${lead.id}`,
      f.token,
      { status: 'QUALIFIED', expectedVersion: 1 },
      'PATCH',
    );
    await authenticated(
      `/leads/${otherLead.id}`,
      f.token,
      { status: 'QUALIFIED', expectedVersion: 1 },
      'PATCH',
    );
    await assign(
      f.org.id,
      f.owner.id,
      scope === 'ORGANIZATION' ? 'DIRECTOR' : 'SELLER',
      scope,
      scope === 'BRANCH' ? [f.a.id] : scope === 'BRANCH_SET' ? [f.a.id, f.b.id] : [],
    );
    const token = (await login(f.owner.user.email)).body.accessToken;
    const expected =
      scope === 'OWN'
        ? [own.id]
        : scope === 'BRANCH'
          ? [own.id, same.id]
          : scope === 'BRANCH_SET'
            ? [own.id, same.id, other.id]
            : [own.id, same.id, other.id, third.id];
    const rows = opportunityListResponseSchema.parse(
      await (await authenticated('/opportunities?limit=100', token)).json(),
    );
    expect(rows.data.map((row) => row.id).sort()).toEqual(expected.sort());
    const leads = leadListResponseSchema.parse(
      await (await authenticated('/leads?limit=100', token)).json(),
    );
    expect(leads.data.map((row) => row.id).sort()).toEqual(
      (scope === 'ORGANIZATION' ? [lead.id, otherLead.id] : [lead.id]).sort(),
    );
    for (const row of [own, same, other, third])
      expect(
        (
          await authenticated(`/opportunities/${row.id}/stage`, token, {
            stageId: f.negotiation.id,
            expectedVersion: 1,
          })
        ).status,
      ).toBe(expected.includes(row.id) ? 200 : 404);
    expect(
      (
        await authenticated(`/leads/${lead.id}/convert`, token, {
          pipelineId: f.pipeline.id,
          stageId: f.entry.id,
          expectedVersion: 2,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await authenticated(`/leads/${otherLead.id}/convert`, token, {
          pipelineId: f.pipeline.id,
          stageId: f.entry.id,
          expectedVersion: 2,
        })
      ).status,
    ).toBe(scope === 'ORGANIZATION' ? 200 : 404);
  },
);
it('branch-specific pipeline rejects destination from another branch while organizational catalogs stay scoped', async () => {
  const f = await salesFixture();
  const response = await authenticated('/pipelines', f.token, {
    name: 'Branch only',
    branchId: f.a.id,
    stages: [{ name: 'Entry' }],
  });
  expect(response.status).toBe(201);
  const pipeline = pipelineResponseSchema.parse(await response.json());
  expect(
    (
      await authenticated('/opportunities', f.token, {
        name: 'Wrong branch',
        branchId: f.b.id,
        ownerMembershipId: f.owner.id,
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0]?.id,
      })
    ).status,
  ).toBe(404);
  await assign(f.org.id, f.owner.id, 'SELLER', 'BRANCH', [f.b.id]);
  const token = (await login(f.owner.user.email)).body.accessToken;
  const list = pipelineListResponseSchema.parse(
    await (await authenticated('/pipelines', token)).json(),
  );
  expect(list.data.map((row) => row.id)).toEqual([f.pipeline.id]);
  expect((await authenticated(`/pipelines/${pipeline.id}`, token)).status).toBe(404);
});
it('archived pipeline retains opportunity/history and rejects new deals and transitions', async () => {
  const f = await salesFixture(),
    record = await opportunityFixture(f);
  expect(
    (await authenticated(`/pipelines/${f.pipeline.id}`, f.token, { expectedVersion: 1 }, 'DELETE'))
      .status,
  ).toBe(200);
  expect((await authenticated(`/opportunities/${record.id}`, f.token)).status).toBe(200);
  expect((await authenticated(`/opportunities/${record.id}/stage-history`, f.token)).status).toBe(
    200,
  );
  expect(
    (
      await authenticated(`/opportunities/${record.id}/stage`, f.token, {
        stageId: f.won.id,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await authenticated('/opportunities', f.token, {
        name: 'Archived',
        branchId: f.a.id,
        pipelineId: f.pipeline.id,
        stageId: f.entry.id,
      })
    ).status,
  ).toBe(404);
});
it('database creates pipeline and stages with composite parent keys', async () => {
  const org = await organization('Pipeline persistence');
  const pipeline = await db().pipeline.create({
    data: {
      organizationId: org.id,
      name: 'Sales',
      normalizedName: 'sales',
      stages: { create: [{ name: 'Entry', normalizedName: 'entry', kind: 'OPEN', position: 0 }] },
    },
    include: { stages: true },
  });
  expect(pipeline.stages).toHaveLength(1);
  expect(pipeline.stages[0]?.organizationId).toBe(org.id);
});
it('conversion cannot borrow assign authority from a broad SELLER read/create scope', async () => {
  const f = await salesFixture(),
    lead = await leadFixture(f, { ownerMembershipId: f.other.id });
  await authenticated(
    `/leads/${lead.id}`,
    f.token,
    { status: 'QUALIFIED', expectedVersion: 1 },
    'PATCH',
  );
  await assign(f.org.id, f.owner.id, 'SELLER', 'ORGANIZATION', []);
  const token = (await login(f.owner.user.email)).body.accessToken;
  expect(
    (
      await authenticated(`/leads/${lead.id}/convert`, token, {
        pipelineId: f.pipeline.id,
        stageId: f.entry.id,
        expectedVersion: 2,
      })
    ).status,
  ).toBe(403);
  expect(await db().opportunity.count({ where: { organizationId: f.org.id } })).toBe(0);
  expect((await db().lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
});
it('sales customer links and assignment histories retain tenant integrity and transaction rollback', async () => {
  const a = await salesFixture(),
    b = await salesFixture(),
    contact = await contactFixture(b),
    company = await companyFixture(b);
  const lead = await leadFixture(a),
    record = await opportunityFixture(a);
  for (const update of [{ contactId: contact.id }, { companyId: company.id }]) {
    await expect(db().lead.update({ where: { id: lead.id }, data: update })).rejects.toThrow();
    await expect(
      db().opportunity.update({ where: { id: record.id }, data: update }),
    ).rejects.toThrow();
    expect(
      (
        await authenticated(
          `/leads/${lead.id}`,
          a.token,
          { ...update, expectedVersion: 1 },
          'PATCH',
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await authenticated(
          `/opportunities/${record.id}`,
          a.token,
          { ...update, expectedVersion: 1 },
          'PATCH',
        )
      ).status,
    ).toBe(404);
  }
  await expect(
    db().opportunity.update({ where: { id: record.id }, data: { amount: '-1' } }),
  ).rejects.toThrow();
  await expect(
    db().opportunity.update({ where: { id: record.id }, data: { currency: 'XXX' } }),
  ).rejects.toThrow();
  const history = await db().opportunityStageHistory.findFirstOrThrow({
    where: { opportunityId: record.id },
  });
  await expect(
    db().opportunityStageHistory.update({
      where: { id: history.id },
      data: { toStageId: b.entry.id },
    }),
  ).rejects.toThrow();
  for (const [resource, id] of [
    ['leads', lead.id],
    ['opportunities', record.id],
  ] as const) {
    const result = await authenticated(
      `/${resource}/${id}`,
      a.token,
      { expectedVersion: 1, branchId: a.b.id, ownerMembershipId: a.other.id },
      'PATCH',
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      branch: { id: a.b.id },
      owner: { id: a.other.id },
      version: 2,
    });
    expect(
      (
        await authenticated(
          `/${resource}/${id}`,
          a.token,
          { expectedVersion: 1, name: 'Stale' },
          'PATCH',
        )
      ).status,
    ).toBe(409);
  }
  expect(await db().leadAssignmentHistory.count({ where: { leadId: lead.id } })).toBe(1);
  expect(
    await db().opportunityAssignmentHistory.count({ where: { opportunityId: record.id } }),
  ).toBe(1);
});

async function taskFixture(
  f: Awaited<ReturnType<typeof commercialFixture>>,
  overrides: Record<string, unknown> = {},
) {
  const result = await authenticated('/tasks', f.token, {
    name: 'Synthetic follow-up',
    branchId: f.a.id,
    ownerMembershipId: f.owner.id,
    kind: 'FOLLOW_UP',
    ...overrides,
  });
  expect(result.status).toBe(201);
  return taskResponseSchema.parse(await result.json());
}
async function taskOwnerToken(f: Awaited<ReturnType<typeof commercialFixture>>) {
  await assign(f.org.id, f.owner.id, 'SELLER', 'OWN');
  return (await login(f.owner.user.email)).body.accessToken;
}
function reminderQueue() {
  return new Queue('notifications', {
    connection: {
      host: environment['REDIS_HOST'] ?? '127.0.0.1',
      port: Number(environment['REDIS_PORT']),
      password: environment['REDIS_PASSWORD'] ?? '',
      maxRetriesPerRequest: 1,
    },
  });
}
it('tasks validate strict payloads, explicit UTC dates and technical Swagger contracts', async () => {
  const f = await commercialFixture();
  for (const payload of [
    { organizationId: f.org.id },
    { status: 'COMPLETED' },
    { dueAt: '2026-10-07T12:00' },
    { remindAt: '2026-10-07T12:00:00Z' },
    { dueAt: '2026-10-07T12:00:00Z', remindAt: '2026-10-08T12:00:00Z' },
  ])
    expect(
      (await authenticated('/tasks', f.token, { name: 'Bad task', branchId: f.a.id, ...payload }))
        .status,
    ).toBe(400);
  const row = await taskFixture(f, { dueAt: '2026-10-07T12:00:00-03:00' });
  expect(row.dueAt).toBe('2026-10-07T15:00:00.000Z');
  expect(JSON.stringify(row)).not.toMatch(/organizationId|createdByMembershipId|reminderVersion/);
  const docs: unknown = await (await fetch(url + '/docs/openapi.json')).json();
  expect(docs).toHaveProperty('paths./api/v1/tasks/{id}/complete.post');
  expect(docs).toHaveProperty('paths./api/v1/activities/{type}/{id}/timeline.get');
  expect(docs).toHaveProperty('paths./api/v1/notifications/{id}/read.post');
});
it('task completion, reopening, edit and archive use atomic versioned history', async () => {
  const f = await commercialFixture();
  const row = await taskFixture(f);
  let changed = taskResponseSchema.parse(
    await (
      await authenticated(`/tasks/${row.id}/complete`, f.token, { expectedVersion: row.version })
    ).json(),
  );
  expect(changed.status).toBe('COMPLETED');
  expect(changed.completedAt).not.toBeNull();
  expect(
    (await authenticated(`/tasks/${row.id}/reopen`, f.token, { expectedVersion: row.version }))
      .status,
  ).toBe(409);
  changed = taskResponseSchema.parse(
    await (
      await authenticated(`/tasks/${row.id}/reopen`, f.token, { expectedVersion: changed.version })
    ).json(),
  );
  expect(changed.completedAt).toBeNull();
  changed = taskResponseSchema.parse(
    await (
      await authenticated(
        `/tasks/${row.id}`,
        f.token,
        { expectedVersion: changed.version, name: 'Edited' },
        'PATCH',
      )
    ).json(),
  );
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        f.token,
        { expectedVersion: changed.version },
        'DELETE',
      )
    ).status,
  ).toBe(200);
  expect(await db().taskHistory.count({ where: { taskId: row.id } })).toBe(5);
  expect(
    (await authenticated(`/tasks/${row.id}/complete`, f.token, { expectedVersion: 5 })).status,
  ).toBe(409);
});
it('task completion races between different actors commit one event and one conflict', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const row = await taskFixture(f);
  const responses = await Promise.all([
    authenticated(`/tasks/${row.id}/complete`, f.token, { expectedVersion: 1 }),
    authenticated(`/tasks/${row.id}/complete`, owner, { expectedVersion: 1 }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db().taskHistory.count({ where: { taskId: row.id } })).toBe(2);
});
it('task foreign keys and checks reject cross-tenant ownership, links, histories and multiple targets', async () => {
  const f = await commercialFixture(),
    other = await commercialFixture();
  const contact = await contactFixture(f),
    foreign = await contactFixture(other);
  const row = await taskFixture(f, { target: { type: 'contact', id: contact.id } });
  expect(
    (
      await authenticated('/tasks', f.token, {
        name: 'Cross tenant',
        branchId: f.a.id,
        target: { type: 'contact', id: foreign.id },
      })
    ).status,
  ).toBe(404);
  await expect(
    db().task.update({ where: { id: row.id }, data: { contactId: foreign.id } }),
  ).rejects.toThrow();
  await expect(
    db().task.update({ where: { id: row.id }, data: { ownerMembershipId: other.owner.id } }),
  ).rejects.toThrow();
  await expect(
    db().taskHistory.create({
      data: {
        organizationId: f.org.id,
        taskId: row.id,
        actorMembershipId: other.owner.id,
        name: 'Bad',
        kind: 'UPDATED',
        recordVersion: 2,
      },
    }),
  ).rejects.toThrow();
  const response = await authenticated('/leads', f.token, {
    name: 'Same tenant target',
    branchId: f.a.id,
    ownerMembershipId: f.owner.id,
  });
  expect(response.status).toBe(201);
  const lead = leadResponseSchema.parse(await response.json());
  await expect(
    db().task.update({ where: { id: row.id }, data: { leadId: lead.id } }),
  ).rejects.toThrow();
  await expect(
    db().task.update({ where: { id: row.id }, data: { status: 'COMPLETED' } }),
  ).rejects.toThrow();
});
it.each(['OWN', 'BRANCH', 'BRANCH_SET', 'ORGANIZATION'] as const)(
  'task scope %s intersects linked resource access before pagination',
  async (scope) => {
    const f = await commercialFixture();
    const mine = await taskFixture(f),
      same = await taskFixture(f, { ownerMembershipId: f.other.id }),
      second = await taskFixture(f, { branchId: f.b.id, ownerMembershipId: f.other.id }),
      third = await taskFixture(f, { branchId: f.c.id, ownerMembershipId: f.other.id });
    const target = await contactFixture(f, { ownerMembershipId: f.other.id });
    const linked = await taskFixture(f, { target: { type: 'contact', id: target.id } });
    await assign(
      f.org.id,
      f.owner.id,
      'SELLER',
      scope,
      scope === 'BRANCH' ? [f.a.id] : scope === 'BRANCH_SET' ? [f.a.id, f.b.id] : [],
    );
    const token = (await login(f.owner.user.email)).body.accessToken;
    const page = taskListResponseSchema.parse(
      await (await authenticated('/tasks?limit=100', token, undefined, 'GET')).json(),
    );
    const ids = page.data.map((r) => r.id);
    expect(ids).toContain(mine.id);
    expect(ids.includes(same.id)).toBe(scope !== 'OWN');
    expect(ids.includes(second.id)).toBe(scope === 'BRANCH_SET' || scope === 'ORGANIZATION');
    expect(ids.includes(third.id)).toBe(scope === 'ORGANIZATION');
    expect(ids.includes(linked.id)).toBe(scope !== 'OWN');
    if (scope === 'OWN') {
      expect((await authenticated(`/tasks/${linked.id}`, token, undefined, 'GET')).status).toBe(
        404,
      );
      expect(
        (await authenticated(`/tasks/${linked.id}/complete`, token, { expectedVersion: 1 })).status,
      ).toBe(404);
    }
  },
);
it('task reassignment cannot borrow broad read authority and preserves old state on conflict', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const row = await taskFixture(f);
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        owner,
        { expectedVersion: 1, ownerMembershipId: f.other.id },
        'PATCH',
      )
    ).status,
  ).toBe(403);
  expect((await db().task.findUniqueOrThrow({ where: { id: row.id } })).ownerMembershipId).toBe(
    f.owner.id,
  );
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        f.token,
        { expectedVersion: 1, branchId: f.b.id, ownerMembershipId: f.other.id },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect((await authenticated(`/tasks/${row.id}`, owner, undefined, 'GET')).status).toBe(404);
});
it('activities require one authorized target and reject foreign tenant and mass assignment', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const contact = await contactFixture(f),
    hidden = await contactFixture(f, { ownerMembershipId: f.other.id });
  const good = await authenticated('/activities', owner, {
    target: { type: 'contact', id: contact.id },
    kind: 'CALL',
    description: ' Synthetic call ',
  });
  expect(good.status).toBe(201);
  expect(activityResponseSchema.parse(await good.json()).description).toBe('Synthetic call');
  expect(
    (
      await authenticated('/activities', owner, {
        target: { type: 'contact', id: hidden.id },
        description: 'Hidden',
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await authenticated('/activities', owner, {
        target: { type: 'contact', id: contact.id },
        description: 'Bad',
        actorMembershipId: f.other.id,
      })
    ).status,
  ).toBe(400);
  await expect(
    db().activity.create({
      data: {
        organizationId: f.org.id,
        actorMembershipId: f.owner.id,
        kind: 'NOTE',
        description: 'No target',
      },
    }),
  ).rejects.toThrow();
  const other = await commercialFixture();
  const foreign = await contactFixture(other);
  await expect(
    db().activity.create({
      data: {
        organizationId: f.org.id,
        actorMembershipId: f.owner.id,
        kind: 'NOTE',
        description: 'Bad',
        contactId: foreign.id,
      },
    }),
  ).rejects.toThrow();
});
it('timeline merges notes, tasks and stages with a stable temporal cursor and no duplicated page', async () => {
  const f = await salesFixture();
  const opp = await opportunityFixture(f);
  const target = { type: 'opportunity', id: opp.id };
  const task = await taskFixture(f, { target });
  expect(
    (await authenticated('/activities', f.token, { target, description: 'Deal note' })).status,
  ).toBe(201);
  expect(
    (await authenticated(`/tasks/${task.id}/complete`, f.token, { expectedVersion: 1 })).status,
  ).toBe(200);
  expect(
    (
      await authenticated(`/opportunities/${opp.id}/stage`, f.token, {
        expectedVersion: 1,
        stageId: f.negotiation.id,
      })
    ).status,
  ).toBe(200);
  const entries: TimelineEntry[] = [];
  let cursor: string | null = null;
  do {
    const page = timelineResponseSchema.parse(
      await (
        await authenticated(
          `/activities/opportunity/${opp.id}/timeline?limit=2${cursor ? '&cursor=' + cursor : ''}`,
          f.token,
          undefined,
          'GET',
        )
      ).json(),
    );
    entries.push(...page.data);
    cursor = page.pageInfo.nextCursor;
  } while (cursor);
  expect(entries).toHaveLength(5);
  expect(new Set(entries.map((r) => r.id)).size).toBe(5);
  expect(new Set(entries.map((r) => r.type))).toEqual(new Set(['TASK', 'ACTIVITY', 'STAGE']));
  const other = await commercialFixture();
  expect(
    (
      await authenticated(
        `/activities/opportunity/${opp.id}/timeline`,
        other.token,
        undefined,
        'GET',
      )
    ).status,
  ).toBe(404);
});
it('worker delivers one durable recipient notification and duplicate jobs cannot duplicate it', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const now = new Date().toISOString();
  const row = await taskFixture(f, { dueAt: now, remindAt: now });
  await until(
    async () => (await db().notification.count({ where: { reminder: { taskId: row.id } } })) === 1,
    'durable notification',
  );
  const reminder = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  expect(reminder.state).toBe('COMPLETED');
  const q = reminderQueue();
  try {
    await q.add('duplicate', { version: 1, reminderId: reminder.id }, { jobId: randomUUID() });
    await until(
      async () => (await q.getActiveCount()) === 0 && (await q.getWaitingCount()) === 0,
      'duplicate job complete',
    );
  } finally {
    await q.close();
  }
  expect(await db().notification.count({ where: { reminderId: reminder.id } })).toBe(1);
  const list = notificationListResponseSchema.parse(
    await (await authenticated('/notifications', owner, undefined, 'GET')).json(),
  );
  expect(list.data.map((n) => n.task.id)).toContain(row.id);
  expect(
    notificationListResponseSchema.parse(
      await (await authenticated('/notifications', f.token, undefined, 'GET')).json(),
    ).data,
  ).toEqual([]);
  const notification = list.data.find((n) => n.task.id === row.id);
  if (!notification) throw new Error('Notification missing');
  const first = notificationResponseSchema.parse(
    await (await authenticated(`/notifications/${notification.id}/read`, owner, {})).json(),
  );
  const second = notificationResponseSchema.parse(
    await (await authenticated(`/notifications/${notification.id}/read`, owner, {})).json(),
  );
  expect(second.readAt).toBe(first.readAt);
  expect((await authenticated(`/notifications/${notification.id}/read`, f.token, {})).status).toBe(
    404,
  );
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        f.token,
        { expectedVersion: 1, name: 'Renamed' },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect(await db().taskReminder.count({ where: { taskId: row.id } })).toBe(1);
});
it('completion cancels pending reminders and reopening creates a separate durable occurrence', async () => {
  const f = await commercialFixture();
  await taskOwnerToken(f);
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(f, { dueAt: future, remindAt: future });
  expect(
    (await authenticated(`/tasks/${row.id}/complete`, f.token, { expectedVersion: 1 })).status,
  ).toBe(200);
  expect((await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } })).state).toBe(
    'CANCELED',
  );
  expect(
    (await authenticated(`/tasks/${row.id}/reopen`, f.token, { expectedVersion: 2 })).status,
  ).toBe(200);
  const reminders = await db().taskReminder.findMany({
    where: { taskId: row.id },
    orderBy: { scheduledVersion: 'asc' },
  });
  expect(reminders.map((r) => r.state)).toEqual(['CANCELED', 'PENDING']);
});
it('reconciler recovers expired dispatch after Redis work disappears, without duplication', async () => {
  const f = await commercialFixture();
  await taskOwnerToken(f);
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(f, { dueAt: future, remindAt: future });
  const reminder = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  await db().task.update({
    where: { id: row.id },
    data: { remindAt: new Date(Date.now() - 1000) },
  });
  await db().taskReminder.update({
    where: { id: reminder.id },
    data: {
      state: 'DISPATCHED',
      availableAt: new Date(Date.now() - 1000),
      leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() - 1000),
    },
  });
  await until(
    async () => (await db().notification.count({ where: { reminderId: reminder.id } })) === 1,
    'reconciled missing Redis work',
  );
  expect((await db().taskReminder.findUniqueOrThrow({ where: { id: reminder.id } })).state).toBe(
    'COMPLETED',
  );
});
it('revoked target visibility cancels delivery and hides an existing notification immediately', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const now = new Date().toISOString();
  const row = await taskFixture(f, { dueAt: now, remindAt: now });
  await until(
    async () => (await db().notification.count({ where: { reminder: { taskId: row.id } } })) === 1,
    'first recipient delivery',
  );
  const contact = await contactFixture(f, { ownerMembershipId: f.other.id });
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        f.token,
        { expectedVersion: 1, target: { type: 'contact', id: contact.id } },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect(
    notificationListResponseSchema.parse(
      await (await authenticated('/notifications', owner, undefined, 'GET')).json(),
    ).data,
  ).toEqual([]);
  await until(
    async () =>
      (await db().taskReminder.count({ where: { taskId: row.id, state: 'CANCELED' } })) === 1,
    'visibility-revoked reminder cancellation',
  );
}, 60000);
it('failed reminder replay is authorized, preserves its identity and allows one local effect', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(f, { dueAt: future, remindAt: future });
  const reminder = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  await db().task.update({
    where: { id: row.id },
    data: { remindAt: new Date(Date.now() - 1000) },
  });
  await db().taskReminder.update({
    where: { id: reminder.id },
    data: { state: 'FAILED', attemptCount: 5, lastErrorCode: 'DELIVERY_UNAVAILABLE' },
  });
  expect(
    reminderStatusSchema.parse(
      await (await authenticated(`/tasks/${row.id}/reminder`, owner, undefined, 'GET')).json(),
    )?.state,
  ).toBe('FAILED');
  expect(
    (await authenticated(`/tasks/${row.id}/reminder-retry`, owner, { expectedVersion: 9 })).status,
  ).toBe(409);
  expect(
    (await authenticated(`/tasks/${row.id}/reminder-retry`, owner, { expectedVersion: 1 })).status,
  ).toBe(200);
  expect(
    (await authenticated(`/tasks/${row.id}/reminder-retry`, owner, { expectedVersion: 1 })).status,
  ).toBe(409);
  await until(
    async () => (await db().notification.count({ where: { reminderId: reminder.id } })) === 1,
    'replayed reminder',
  );
  const stored = await db().taskReminder.findUniqueOrThrow({ where: { id: reminder.id } });
  expect(stored.state).toBe('COMPLETED');
  expect(stored.attemptCount).toBe(0);
  await expect(
    db().notification.create({
      data: {
        organizationId: f.org.id,
        reminderId: reminder.id,
        recipientMembershipId: f.other.id,
      },
    }),
  ).rejects.toThrow();
});
it('a Redis outage leaves a committed reminder recoverable instead of losing its intent', async () => {
  const f = await commercialFixture();
  await taskOwnerToken(f);
  await compose('pause', 'redis');
  let taskId: string;
  try {
    const now = new Date().toISOString(),
      row = await taskFixture(f, { dueAt: now, remindAt: now });
    taskId = row.id;
    expect(
      await db().taskReminder.count({
        where: { taskId, state: { in: ['PENDING', 'DISPATCHED'] } },
      }),
    ).toBe(1);
    expect(await db().notification.count({ where: { reminder: { taskId } } })).toBe(0);
  } finally {
    await compose('unpause', 'redis');
  }
  await until(
    async () => (await db().notification.count({ where: { reminder: { taskId } } })) === 1,
    'Redis recovery and eventual delivery',
  );
});
it('invalid BullMQ payloads fail permanently without retrying or creating a notification', async () => {
  const q = reminderQueue();
  const jobId = randomUUID();
  try {
    await q.add(
      'invalid-contract',
      { version: 9, reminderId: randomUUID() },
      { jobId, attempts: 5, backoff: { type: 'exponential', delay: 1000 } },
    );
    await until(
      async () => (await q.getJob(jobId))?.getState().then((state) => state === 'failed') ?? false,
      'permanent invalid job failure',
    );
    const job = await q.getJob(jobId);
    expect(job?.attemptsMade).toBe(1);
    expect(job?.failedReason).toBe('Invalid reminder job contract');
  } finally {
    await q.close();
  }
});
it('five real delivery failures persist a replayable failure and retry produces one notification', async () => {
  const f = await commercialFixture();
  const owner = await taskOwnerToken(f);
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(f, { dueAt: future, remindAt: future });
  const intent = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  // Fault injection in this disposable database: the real worker insert must fail and roll back.
  await db()
    .$executeRaw`ALTER TABLE notifications ADD CONSTRAINT notification_delivery_fault CHECK (false) NOT VALID`;
  try {
    await db().task.update({
      where: { id: row.id },
      data: { remindAt: new Date(Date.now() - 1000) },
    });
    await db().taskReminder.update({
      where: { id: intent.id },
      data: { availableAt: new Date(Date.now() - 1000) },
    });
    await until(
      async () =>
        (await db().taskReminder.findUniqueOrThrow({ where: { id: intent.id } })).state ===
        'FAILED',
      'five real retries',
      50000,
    );
    const failed = await db().taskReminder.findUniqueOrThrow({ where: { id: intent.id } });
    expect(failed.attemptCount).toBe(5);
    expect(failed.lastErrorCode).toBe('DELIVERY_UNAVAILABLE');
    const q = reminderQueue();
    try {
      await until(
        async () =>
          (await q.getJob(intent.id))?.getState().then((state) => state === 'failed') ?? false,
        'queue failure checkpoint',
      );
      expect((await q.getJob(intent.id))?.failedReason).toBe('Reminder delivery failed');
    } finally {
      await q.close();
    }
    expect(await db().notification.count({ where: { reminderId: intent.id } })).toBe(0);
  } finally {
    await db().$executeRaw`ALTER TABLE notifications DROP CONSTRAINT notification_delivery_fault`;
  }
  expect(
    (await authenticated(`/tasks/${row.id}/reminder-retry`, owner, { expectedVersion: 1 })).status,
  ).toBe(200);
  await until(
    async () => (await db().notification.count({ where: { reminderId: intent.id } })) === 1,
    'successful durable replay',
  );
}, 80000);
it('task due-date filters use explicit UTC intervals and apply search before pagination', async () => {
  const f = await commercialFixture(),
    now = new Date(),
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = await taskFixture(f, {
      name: 'Yesterday',
      dueAt: new Date(start.getTime() - 3600000).toISOString(),
    }),
    today = await taskFixture(f, {
      name: 'Today',
      dueAt: start.toISOString(),
      description: 'distinct-search-text',
    }),
    tomorrow = await taskFixture(f, {
      name: 'Tomorrow',
      dueAt: new Date(start.getTime() + 86400000).toISOString(),
    });
  await taskFixture(f);
  const list = async (query: string) =>
    taskListResponseSchema
      .parse(await (await authenticated('/tasks?' + query, f.token, undefined, 'GET')).json())
      .data.map((row) => row.id);
  expect(await list('due=today')).toEqual([today.id]);
  expect(new Set(await list('due=overdue'))).toEqual(new Set([yesterday.id, today.id]));
  expect(await list('due=upcoming')).toEqual([tomorrow.id]);
  expect(await list('search=distinct-search-text&limit=1')).toEqual([today.id]);
  const complete = await authenticated(`/tasks/${today.id}/complete`, f.token, {
    expectedVersion: 1,
  });
  expect(complete.status).toBe(200);
  expect(await list('due=overdue')).toEqual([yesterday.id]);
  const patched = await authenticated(
    `/tasks/${tomorrow.id}`,
    f.token,
    { expectedVersion: 1, remindAt: new Date(start.getTime() + 90000000).toISOString() },
    'PATCH',
  );
  expect(patched.status).toBe(400);
  expect((await db().task.findUniqueOrThrow({ where: { id: tomorrow.id } })).version).toBe(1);
});
it('a duplicate job before its scheduled time neither delivers early nor consumes an attempt', async () => {
  const f = await commercialFixture();
  await taskOwnerToken(f);
  const future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(f, { dueAt: future, remindAt: future });
  const intent = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  const q = reminderQueue();
  const jobId = randomUUID();
  try {
    await q.add('early-duplicate', { version: 1, reminderId: intent.id }, { jobId });
    await until(
      async () => (await q.getJob(jobId))?.getState().then((s) => s === 'completed') ?? false,
      'early duplicate job completes without effect',
    );
  } finally {
    await q.close();
  }
  expect(await db().notification.count({ where: { reminderId: intent.id } })).toBe(0);
  expect(await db().taskReminder.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({
    state: 'PENDING',
    attemptCount: 0,
    availableAt: new Date(future),
  });
});
it('task histories, commands, timelines and notifications never resolve foreign-tenant IDs', async () => {
  const a = await commercialFixture(),
    b = await commercialFixture();
  const contact = await contactFixture(b),
    future = new Date(Date.now() + 3600000).toISOString();
  const row = await taskFixture(b, {
    dueAt: future,
    remindAt: future,
    target: { type: 'contact', id: contact.id },
  });
  const intent = await db().taskReminder.findFirstOrThrow({ where: { taskId: row.id } });
  const notice = await db().notification.create({
    data: { organizationId: b.org.id, recipientMembershipId: b.owner.id, reminderId: intent.id },
  });
  for (const suffix of ['', '/history', '/reminder'])
    expect(
      (await authenticated(`/tasks/${row.id}${suffix}`, a.token, undefined, 'GET')).status,
    ).toBe(404);
  expect(
    (
      await authenticated(
        `/tasks/${row.id}`,
        a.token,
        { expectedVersion: 1, name: 'Foreign' },
        'PATCH',
      )
    ).status,
  ).toBe(404);
  for (const suffix of ['complete', 'reminder-retry'])
    expect(
      (await authenticated(`/tasks/${row.id}/${suffix}`, a.token, { expectedVersion: 1 })).status,
    ).toBe(404);
  expect(
    (await authenticated(`/activities/contact/${contact.id}/timeline`, a.token, undefined, 'GET'))
      .status,
  ).toBe(404);
  expect((await authenticated(`/notifications/${notice.id}/read`, a.token, {})).status).toBe(404);
  expect(
    notificationListResponseSchema.parse(
      await (await authenticated('/notifications', a.token, undefined, 'GET')).json(),
    ).data,
  ).toEqual([]);
  expect((await db().task.findUniqueOrThrow({ where: { id: row.id } })).version).toBe(1);
  expect(
    (await db().notification.findUniqueOrThrow({ where: { id: notice.id } })).readAt,
  ).toBeNull();
});
