import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabaseClient } from '@crm/database';
const execute = promisify(execFile);
const project = `crm-browser-${randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), 'crm-browser-'));
const envFile = join(directory, '.env');
const secret = () => randomBytes(24).toString('hex');
const databasePassword = secret();
const redisPassword = secret();
await writeFile(
  envFile,
  `POSTGRES_DB=crm_test\nPOSTGRES_USER=crm_test\nPOSTGRES_PASSWORD=${databasePassword}\nPOSTGRES_PORT=0\nREDIS_PORT=0\nREDIS_PASSWORD=${redisPassword}\n`,
  { mode: 0o600 },
);
const composeArgs = [
  'compose',
  '--file',
  'docker-compose.yml',
  '--env-file',
  envFile,
  '--project-name',
  project,
];
const compose = (...args) =>
  execute('docker', [...composeArgs, ...args], {
    timeout: 90000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      POSTGRES_DB: 'crm_test',
      POSTGRES_USER: 'crm_test',
      POSTGRES_PASSWORD: databasePassword,
      POSTGRES_PORT: '0',
      REDIS_PORT: '0',
      REDIS_PASSWORD: redisPassword,
    },
  });
const children = [];
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  for (const child of children) {
    if (child.exitCode === null) {
      const exit = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exit;
    }
  }
  await compose('down', '--volumes');
  await rm(directory, { recursive: true, force: true });
  await rm('.runtime/browser-fixture.json', { force: true });
}
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    void stop().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      },
    );
  });
function start(args, env, cwd = process.cwd()) {
  const child = spawn(process.execPath, args, { env, cwd, stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    console.error(error);
    void stop().then(() => process.exit(1));
  });
  return child;
}
async function ready(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Browser test service failed to start');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Browser test readiness timed out');
}
try {
  await compose('up', '-d', '--wait', 'postgres', 'redis');
  const databasePort = (await compose('port', 'postgres', '5432')).stdout.trim().split(':').at(-1);
  const redisPort = (await compose('port', 'redis', '6379')).stdout.trim().split(':').at(-1);
  const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL);
  if (!['localhost', '127.0.0.1'].includes(apiUrl.hostname) || apiUrl.pathname !== '/api/v1')
    throw new Error('Browser tests require a loopback API URL ending in /api/v1');
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: `postgresql://crm_test:${databasePassword}@127.0.0.1:${databasePort}/crm_test`,
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: redisPort,
    REDIS_PASSWORD: redisPassword,
    JWT_SECRET: randomBytes(32).toString('base64url'),
    API_PORT: apiUrl.port,
    CORS_ORIGINS: 'http://localhost:3000',
    SEED_ADMIN_EMAIL: 'admin.demo@example.test',
    SEED_ADMIN_PASSWORD: secret(),
    SEED_PLATFORM_PROVISIONING: 'false',
    AUTH_LOGIN_IP_LIMIT: '1000',
    AUTH_LOGIN_IDENTITY_LIMIT: '500',
    AUTH_REFRESH_IP_LIMIT: '1000',
  };
  await execute('pnpm', ['--filter', '@crm/database', 'db:migrate:deploy'], {
    env: environment,
    timeout: 30000,
  });
  await execute(process.execPath, ['apps/api/dist/bootstrap/seed.js'], {
    env: environment,
    timeout: 30000,
  });
  const db = createDatabaseClient(environment.DATABASE_URL);
  let firstOrganizationId;
  let secondOrganizationId;
  try {
    const user = await db.user.findUniqueOrThrow({
      where: { email: environment.SEED_ADMIN_EMAIL },
    });
    const original = await db.organizationMembership.findFirstOrThrow({
      where: { userId: user.id },
    });
    firstOrganizationId = original.organizationId;
    const org = await db.organization.create({ data: { name: 'Organização B — teste' } });
    secondOrganizationId = org.id;
    const member = await db.organizationMembership.create({
      data: { organizationId: org.id, userId: user.id },
    });
    const role = await db.role.create({
      data: {
        organizationId: org.id,
        code: 'VIEWER',
        name: 'Visualizador',
        description: 'Fixture browser',
      },
    });
    const permission = await db.permission.findUniqueOrThrow({ where: { code: 'users.read' } });
    await db.rolePermission.create({
      data: { organizationId: org.id, roleId: role.id, permissionId: permission.id },
    });
    await db.userRole.create({
      data: {
        organizationId: org.id,
        membershipId: member.id,
        roleId: role.id,
        scope: 'ORGANIZATION',
      },
    });
  } finally {
    await db.$disconnect();
  }
  await mkdir('.runtime', { recursive: true });
  await writeFile(
    '.runtime/browser-fixture.json',
    JSON.stringify({
      email: environment.SEED_ADMIN_EMAIL,
      password: environment.SEED_ADMIN_PASSWORD,
      databaseUrl: environment.DATABASE_URL,
      firstOrganizationId,
      secondOrganizationId,
    }),
    { mode: 0o600 },
  );
  const api = start(['apps/api/dist/bootstrap/main.js'], environment);
  await ready(`${apiUrl.origin}/health/ready`, api);
  start(['apps/worker/dist/bootstrap/main.js'], environment);
  const web = start(
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1'],
    { ...process.env, NODE_ENV: 'production' },
    join(process.cwd(), 'apps/web'),
  );
  await ready('http://localhost:3000/login', web);
  console.info('Browser environment ready: isolated PostgreSQL/Redis and real API/web/worker.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Browser environment failed');
  await stop();
  process.exit(1);
}
