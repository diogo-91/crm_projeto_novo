import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as secureRequest, Agent as SecureAgent } from 'node:https';
import { request as plainRequest, Agent as PlainAgent } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { authResponseSchema, meResponseSchema, organizationResponseSchema } from '@crm/contracts';
const execute = promisify(execFile);
const project = `crm-deploy-${randomUUID()}`;
const proxyNetwork = `${project}-proxy`;
const proxyContainer = `${project}-edge`;
const domain = 'crm.test';
const secrets = {
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  REDIS_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(32).toString('base64url'),
  INITIAL_ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
};
let directory = '';
let args: string[] = [];
let certificate = '';
let securePort = 0;
let httpPort = 0;
let access = '';
let cookie = '';
let originalCookie = '';
let organizationId = '';
let configured = false;
let initializationEnvironment = '';
function redacted(value: string) {
  return Object.values(secrets).reduce(
    (text, secret) => text.replaceAll(secret, '[REDACTED]'),
    value,
  );
}
async function docker(parameters: string[], timeout = 120000, input?: string): Promise<string> {
  try {
    const completion = execute('docker', parameters, { timeout, maxBuffer: 16 * 1024 * 1024 });
    if (input !== undefined) {
      const stdin = completion.child.stdin;
      if (stdin === null) {
        await completion;
        throw new Error('Docker command did not provide stdin');
      }
      stdin.end(input);
    }
    const result = await completion;
    return result.stdout.trim();
  } catch (error: unknown) {
    const details =
      error instanceof Error
        ? error.message +
          ('stdout' in error && typeof error.stdout === 'string' ? '\n' + error.stdout : '')
        : 'unknown Docker failure';
    // Redact the complete diagnostic before attaching it as the original cause.
    if (error instanceof Error) {
      error.message = redacted(error.message);
      if (error.stack) error.stack = redacted(error.stack);
      if ('stdout' in error && typeof error.stdout === 'string')
        error.stdout = redacted(error.stdout);
      if ('stderr' in error && typeof error.stderr === 'string')
        error.stderr = redacted(error.stderr);
      if ('cmd' in error && typeof error.cmd === 'string') error.cmd = redacted(error.cmd);
    }
    throw new Error(redacted(details), { cause: error });
  }
}
function compose(...parameters: string[]) {
  return docker([...args, ...parameters]);
}
function edge(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
  secure = true,
): Promise<{ status: number; body: string; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: secure ? securePort : httpPort,
      path,
      method,
      headers: { Host: domain, ...headers },
      // This fixture is loopback-only; environment internet proxies must not route it.
      agent: secure ? new SecureAgent({ proxyEnv: {} }) : new PlainAgent({ proxyEnv: {} }),
      ...(secure ? { ca: certificate, servername: domain } : {}),
      timeout: 10000,
    };
    const request = (secure ? secureRequest : plainRequest)(options, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        text += chunk;
      });
      response.on('end', () =>
        resolve({ status: response.statusCode ?? 0, body: text, headers: response.headers }),
      );
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('HTTPS probe timed out')));
    request.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function poll(condition: () => Promise<boolean>) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Deployment did not become ready');
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'crm-production-test-'));
  // A CA for this isolated fixture, verified explicitly by every HTTPS request.
  await execute('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    join(directory, 'key.pem'),
    '-out',
    join(directory, 'cert.pem'),
    '-days',
    '1',
    '-subj',
    `/CN=${domain}`,
    '-addext',
    `subjectAltName=DNS:${domain}`,
  ]);
  certificate = await readFile(join(directory, 'cert.pem'), 'utf8');
  await writeFile(
    join(directory, 'tls.yml'),
    'tls:\n  certificates:\n    - certFile: /certificates/cert.pem\n      keyFile: /certificates/key.pem\n',
    { mode: 0o600 },
  );
  await docker(['network', 'create', proxyNetwork]);
  const proxySubnet = await docker([
    'network',
    'inspect',
    '--format',
    '{{(index .IPAM.Config 0).Subnet}}',
    proxyNetwork,
  ]);
  await docker([
    'run',
    '-d',
    '--name',
    proxyContainer,
    '--network',
    proxyNetwork,
    // Cloud Docker may inject internet proxies. Internal fixture traffic stays on its own network.
    '--env',
    `NO_PROXY=localhost,127.0.0.1,${proxySubnet}`,
    '--env',
    `no_proxy=localhost,127.0.0.1,${proxySubnet}`,
    // Docker CLI may inject internet proxies; this edge routes only local containers.
    '-e',
    'NO_PROXY=*',
    '-e',
    'no_proxy=*',
    '-p',
    '127.0.0.1::443',
    '-p',
    '127.0.0.1::80',
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock:ro',
    '-v',
    `${directory}:/certificates:ro`,
    'traefik:v3.6@sha256:31267173a15b4944e797a76ffd9c419707c8d8b32fe5b610f80cd0cfa05f372d',
    '--providers.docker=true',
    '--providers.docker.exposedbydefault=false',
    `--providers.docker.network=${proxyNetwork}`,
    '--providers.file.filename=/certificates/tls.yml',
    '--entrypoints.https.address=:443',
    '--entrypoints.http.address=:80',
    '--accesslog=true',
  ]);
  const proxyIP = await docker([
    'inspect',
    '--format',
    `{{(index .NetworkSettings.Networks "${proxyNetwork}").IPAddress}}`,
    proxyContainer,
  ]);
  const secureMapping = await docker(['port', proxyContainer, '443']);
  const httpMapping = await docker(['port', proxyContainer, '80']);
  securePort = Number(secureMapping.split(':').at(-1));
  httpPort = Number(httpMapping.split(':').at(-1));
  const environment = {
    ...secrets,
    CRM_DEPLOYMENT_NAME: project,
    CRM_HOST: domain,
    COOLIFY_PROXY_NETWORK: proxyNetwork,
    NEXT_PUBLIC_API_URL: `https://${domain}/api/v1`,
    CORS_ORIGINS: `https://${domain}`,
    POSTGRES_DB: 'crm',
    POSTGRES_USER: 'crm',
    DATABASE_URL: `postgresql://crm:${secrets.POSTGRES_PASSWORD}@postgres:5432/crm`,
    TRUST_PROXY_CIDRS: `${proxyIP}/32`,
    INITIAL_SETUP_CONFIRM: 'CREATE_FIRST_ORGANIZATION',
    INITIAL_ORGANIZATION_NAME: 'Synthetic Production',
    INITIAL_BRANCH_NAME: 'Main',
    INITIAL_BRANCH_CODE: 'MAIN',
    INITIAL_ADMIN_NAME: 'Initial Administrator',
    INITIAL_ADMIN_EMAIL: 'initial@example.test',
  };
  initializationEnvironment = Object.entries(environment)
    .filter(([key]) => key.startsWith('INITIAL_'))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n');
  await writeFile(
    join(directory, '.env'),
    Object.entries(environment)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    { mode: 0o600 },
  );
  // Local TLS fixture has a pinned certificate, no ACME/Let's Encrypt calls.
  await writeFile(
    join(directory, 'override.yml'),
    `services:\n  api:\n    labels:\n      - traefik.http.routers.${project}-api.tls.certresolver=\n  web:\n    labels:\n      - traefik.http.routers.${project}-web.tls.certresolver=\n`,
    { mode: 0o600 },
  );
  // Supply the existing trusted corporate CA only to BuildKit, never to images.
  const buildCA = process.env['NODE_EXTRA_CA_CERTS'];
  if (buildCA) {
    const override = await readFile(join(directory, 'override.yml'), 'utf8');
    const caOptions = `  initial-setup:\n    build:\n      secrets: [build_ca]\n  migrate:\n    build:\n      secrets: [build_ca]\n  worker:\n    build:\n      secrets: [build_ca]\n`;
    const withCA = override
      .replace('  api:\n', '  api:\n    build:\n      secrets: [build_ca]\n')
      .replace('  web:\n', '  web:\n    build:\n      secrets: [build_ca]\n');
    await writeFile(
      join(directory, 'override.yml'),
      withCA + caOptions + `secrets:\n  build_ca:\n    file: ${JSON.stringify(buildCA)}\n`,
      { mode: 0o600 },
    );
  }
  args = [
    'compose',
    '--project-name',
    project,
    '--file',
    'docker-compose.production.yml',
    '--file',
    join(directory, 'override.yml'),
    '--env-file',
    join(directory, '.env'),
  ];
  configured = true;
  const builder = process.env['BUILDX_BUILDER'];
  await docker(
    [...args, '--profile', 'operations', 'build', ...(builder ? ['--builder', builder] : [])],
    900000,
  );
  await compose('up', '-d', '--wait', '--wait-timeout', '150', 'postgres', 'redis');
  // Profile services are skipped by a regular build: always rebuild the migrator for this release.
  await compose('run', '--build', '--rm', 'migrate');
  await compose('up', '-d', '--wait', '--wait-timeout', '150');
  try {
    await poll(async () => (await edge('/health/ready')).status === 200);
  } catch (error: unknown) {
    const response = await edge('/health/ready');
    const proxyLogs = await docker(['logs', proxyContainer]);
    throw new Error(
      redacted(`HTTPS readiness: ${response.status} ${response.body}\n${proxyLogs}`),
      {
        cause: error,
      },
    );
  }
});
afterAll(async () => {
  try {
    if (configured) {
      const logs = await compose('logs', '--no-color');
      for (const secret of Object.values(secrets))
        expect(logs.includes(secret), 'Container logs must not expose secret values').toBe(false);
    }
  } finally {
    if (configured) await compose('down', '--volumes', '--remove-orphans');
    const images = await docker([
      'image',
      'ls',
      '--filter',
      `reference=${project}-*`,
      '--format',
      '{{.Repository}}:{{.Tag}}',
    ]);
    const imageTags = [...new Set(images.split('\n').filter(Boolean))];
    if (imageTags.length) await docker(['image', 'rm', ...imageTags]);
    const existing = await docker(['ps', '-aq', '--filter', `name=^/${proxyContainer}$`]);
    if (existing) await docker(['rm', '-f', proxyContainer]);
    const network = await docker(['network', 'ls', '--filter', `name=^${proxyNetwork}$`, '-q']);
    if (network) await docker(['network', 'rm', proxyNetwork]);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
it('builds isolated production images, migrations and healthy HTTP processes', async () => {
  expect((await edge('/login')).status).toBe(200);
  for (const route of ['/health', '/health/live', '/health/ready'])
    expect((await edge(route)).status).toBe(200);
  const status = await compose(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'crm',
    '-d',
    'crm',
    '-Atc',
    'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  expect(status).toBe('10');
  expect(await compose('logs', 'worker')).toContain('worker ready');
});
it('redirects HTTP to HTTPS and does not expose Swagger publicly', async () => {
  const redirect = await edge('/login', 'GET', undefined, {}, false);
  expect([301, 308]).toContain(redirect.status);
  expect(redirect.headers.location).toBe(`https://${domain}/login`);
  expect((await edge('/docs')).status).toBe(404);
  const schema = await compose(
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3001/docs/openapi.json').then(async r=>{const d=await r.json();console.log(r.status,Boolean(d.paths['/api/v1/quotes']))})",
  );
  expect(schema).toBe('200 true');
});
it('runs explicit production initialization once and preserves identities on repeat', async () => {
  // Exercise the documented API-container command; secrets travel on stdin, never argv.
  const initialize = () =>
    docker(
      [
        ...args,
        'exec',
        '-T',
        'api',
        'node',
        '--env-file=/dev/stdin',
        'apps/api/dist/bootstrap/initial-setup.js',
      ],
      120000,
      initializationEnvironment,
    );
  const attempts = await Promise.allSettled([initialize(), initialize()]);
  const failures = attempts
    .filter((attempt) => attempt.status === 'rejected')
    .map((attempt) => String(attempt.reason));
  expect(
    attempts.filter((attempt) => attempt.status === 'fulfilled'),
    failures.join('\n'),
  ).toHaveLength(1);
  expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
  for (const attempt of attempts)
    if (attempt.status === 'rejected') expect(String(attempt.reason)).toContain('startup failed');
  const before = await compose(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'crm',
    '-d',
    'crm',
    '-Atc',
    'SELECT id, created_at, updated_at, security_version FROM users ORDER BY id',
  );
  await expect(compose('run', '--rm', '--no-deps', 'initial-setup')).rejects.toThrow(
    'startup failed',
  );
  const after = await compose(
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'crm',
    '-d',
    'crm',
    '-Atc',
    'SELECT id, created_at, updated_at, security_version FROM users ORDER BY id',
  );
  expect(after).toBe(before);
  expect(
    await compose(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'crm',
      '-d',
      'crm',
      '-Atc',
      'SELECT (SELECT count(*) FROM organizations), (SELECT count(*) FROM branches), (SELECT count(*) FROM users), (SELECT count(*) FROM roles), (SELECT count(*) FROM permissions), (SELECT count(*) FROM platform_grants)',
    ),
  ).toBe('1|1|1|6|52|0');
});
it('authenticates through the real TLS proxy and issues secure host-only cookies', async () => {
  const result = await edge(
    '/api/v1/auth/login',
    'POST',
    { email: 'initial@example.test', password: secrets.INITIAL_ADMIN_PASSWORD },
    { Origin: `https://${domain}`, 'Content-Type': 'application/json' },
  );
  expect(result.status).toBe(200);
  const session = authResponseSchema.parse(JSON.parse(result.body) as unknown);
  access = session.accessToken;
  organizationId = session.context?.organizationId ?? '';
  expect(organizationId).not.toBe('');
  const header = result.headers['set-cookie']?.[0] ?? '';
  expect(header).toMatch(/^__Host-crm-refresh=/);
  expect(header).toContain('HttpOnly');
  expect(header).toContain('Secure');
  expect(header).toContain('SameSite=Lax');
  expect(header).not.toContain('Domain=');
  cookie = header.split(';')[0] ?? '';
  originalCookie = cookie;
  const me = await edge('/api/v1/auth/me', 'GET', undefined, { Authorization: `Bearer ${access}` });
  expect(me.status).toBe(200);
  expect(meResponseSchema.parse(JSON.parse(me.body) as unknown).context?.organizationId).toBe(
    organizationId,
  );
});
it('refreshes and rotates the secure cookie on the same origin', async () => {
  const result = await edge(
    '/api/v1/auth/refresh',
    'POST',
    {},
    { Origin: `https://${domain}`, 'Content-Type': 'application/json', Cookie: cookie },
  );
  expect(result.status).toBe(200);
  access = authResponseSchema.parse(JSON.parse(result.body) as unknown).accessToken;
  cookie = result.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
  expect(cookie).not.toBe(originalCookie);
  const organization = await edge(`/api/v1/organizations/${organizationId}`, 'GET', undefined, {
    Authorization: `Bearer ${access}`,
  });
  expect(organization.status).toBe(200);
  expect(organizationResponseSchema.parse(JSON.parse(organization.body) as unknown).name).toBe(
    'Synthetic Production',
  );
});
it('rejects anonymous administration and foreign cookie origins', async () => {
  expect((await edge('/api/v1/quotes')).status).toBe(401);
  expect(
    (
      await edge(
        '/api/v1/auth/refresh',
        'POST',
        {},
        { Origin: 'https://foreign.test', 'Content-Type': 'application/json', Cookie: cookie },
      )
    ).status,
  ).toBe(403);
});
it('ignores client-forged forwarded IPs at the trusted edge', async () => {
  await compose(
    'exec',
    '-T',
    'redis',
    'sh',
    '-c',
    'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli FLUSHDB',
  );
  const identity = { email: 'missing@example.test', password: 'synthetic-invalid-password' };
  for (let index = 1; index <= 6; index++) {
    const result = await edge('/api/v1/auth/login', 'POST', identity, {
      Origin: `https://${domain}`,
      'Content-Type': 'application/json',
      'X-Forwarded-For': `203.0.113.${index}`,
    });
    expect(result.status).toBe(index <= 5 ? 401 : 429);
  }
});
it('validates API to worker queue processing in production containers', async () => {
  const result = await compose(
    'exec',
    '-T',
    'api',
    'node',
    'apps/api/dist/bootstrap/queue-probe.js',
  );
  expect(result).toContain('queue probe completed');
});
it('runs applications without root or development dependencies and keeps database ports private', async () => {
  for (const service of ['api', 'worker', 'web'])
    expect(await compose('exec', '-T', service, 'id', '-u')).toBe('1000');
  const check = await compose(
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    "try { import.meta.resolve('typescript'); process.exit(1) } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND') throw error; console.log('production dependencies') }",
  );
  expect(check).toBe('production dependencies');
  for (const service of ['postgres', 'redis', 'api', 'web']) {
    const id = await compose('ps', '-q', service);
    expect(await docker(['inspect', '--format', '{{json .HostConfig.PortBindings}}', id])).toBe(
      '{}',
    );
  }
});
it('preserves volumes on restart, keeps secrets out of public assets and shuts down gracefully', async () => {
  const assetScan = await compose(
    'exec',
    '-T',
    'web',
    'node',
    '-e',
    "const fs=await import('node:fs/promises');const files=await fs.readdir('apps/web/.next/static',{recursive:true});const js=files.filter(f=>f.endsWith('.js'));console.log(JSON.stringify(await Promise.all(js.map(f=>fs.readFile('apps/web/.next/static/'+f,'utf8')))))",
  );
  for (const secret of Object.values(secrets))
    expect(assetScan.includes(secret), 'Public assets must not expose secret values').toBe(false);
  expect(assetScan).toContain(`https://${domain}/api/v1`);
  await compose('restart', 'api', 'worker', 'web');
  await poll(async () => (await edge('/health/ready')).status === 200);
  expect(
    await compose(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'crm',
      '-d',
      'crm',
      '-Atc',
      'SELECT count(*) FROM users',
    ),
  ).toBe('1');
  await compose('stop', 'api', 'worker');
  for (const service of ['api', 'worker'])
    expect(await compose('logs', service)).toContain('shutdown complete');
});
