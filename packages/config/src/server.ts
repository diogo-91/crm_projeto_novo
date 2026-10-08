import { z } from 'zod';
import { isIP } from 'node:net';
import {
  emailSchema,
  newPasswordSchema,
  createOrganizationSchema,
  createBranchSchema,
} from '@crm/contracts';
export type EnvironmentInput = Readonly<Record<string, unknown>>;
const port = z.coerce.number().int().min(1).max(65535);
const origin = z.url().pipe(
  z.string().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'Expected an HTTP(S) origin without path or wildcard'),
);
const common = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  REDIS_HOST: z.string().trim().min(1),
  REDIS_PORT: port,
  REDIS_PASSWORD: z.string().min(1).optional(),
});
const database = z.object({
  DATABASE_URL: z
    .url()
    .pipe(
      z
        .string()
        .refine(
          (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
          'Expected PostgreSQL URL',
        ),
    ),
});
const api = common.extend(database.shape).extend({
  API_PORT: port,
  API_HOST: z
    .string()
    .refine((value) => isIP(value) !== 0, 'Expected an IP address')
    .default('127.0.0.1'),
  TRUST_PROXY_CIDRS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z.string().refine((value) => {
          const parts = value.split('/');
          const address = parts[0] ?? '';
          const family = isIP(address);
          if (family === 0 || parts.length > 2) return false;
          if (parts.length === 1) return true;
          const prefix = parts[1] ?? '';
          return (
            /^\d+$/.test(prefix) &&
            Number(prefix) >= 1 &&
            Number(prefix) <= (family === 4 ? 32 : 128)
          );
        }, 'Expected an explicit IP or bounded CIDR'),
      ),
    ),
  JWT_SECRET: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .refine((value) => {
      const bytes = Buffer.from(value, 'base64url');
      return (
        bytes.length === 32 && bytes.toString('base64url') === value && new Set(bytes).size >= 12
      );
    }),
  JWT_ISSUER: z.string().trim().min(1).max(128).default('crm-api'),
  JWT_AUDIENCE: z.string().trim().min(1).max(128).default('crm-web'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(900),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(2592000),
  AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().min(1).max(10000).default(30),
  AUTH_LOGIN_IDENTITY_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
  AUTH_REFRESH_IP_LIMIT: z.coerce.number().int().min(1).max(10000).default(60),
  CORS_ORIGINS: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(z.array(origin).min(1)),
});
function parse<Schema extends z.ZodType>(
  schema: Schema,
  input: EnvironmentInput,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
export function parseApiEnvironment(input: EnvironmentInput) {
  return { ...parse(api, input), role: 'api' as const };
}
export function parseWorkerEnvironment(input: EnvironmentInput) {
  return { ...parse(common.extend(database.shape), input), role: 'worker' as const };
}
export function parseDatabaseEnvironment(input: EnvironmentInput) {
  return parse(database, input);
}
export type ApiConfig = ReturnType<typeof parseApiEnvironment>;
export type WorkerConfig = ReturnType<typeof parseWorkerEnvironment>;
export type RuntimeConfig = ApiConfig | WorkerConfig;

export function parseSeedEnvironment(input: EnvironmentInput) {
  return {
    ...parse(
      database.extend({
        NODE_ENV: z.enum(['development', 'test']),
        LOG_LEVEL: common.shape.LOG_LEVEL,
        SEED_ADMIN_PASSWORD: newPasswordSchema,
        SEED_ADMIN_EMAIL: emailSchema.default('admin.demo@example.test'),
        SEED_PLATFORM_PROVISIONING: z
          .enum(['true', 'false'])
          .default('false')
          .transform((value) => value === 'true'),
      }),
      input,
    ),
    role: 'seed' as const,
  };
}
export type SeedConfig = ReturnType<typeof parseSeedEnvironment>;
export type DatabaseConfig = ReturnType<typeof parseDatabaseEnvironment>;

export function parseInitialSetupEnvironment(input: EnvironmentInput) {
  return {
    ...parse(
      database.extend({
        NODE_ENV: z.literal('production'),
        LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
        INITIAL_SETUP_CONFIRM: z.literal('CREATE_FIRST_ORGANIZATION'),
        INITIAL_ORGANIZATION_NAME: createOrganizationSchema.shape.name,
        INITIAL_BRANCH_NAME: createBranchSchema.shape.name,
        INITIAL_BRANCH_CODE: createBranchSchema.shape.code,
        INITIAL_ADMIN_NAME: z.string().trim().min(1).max(160),
        INITIAL_ADMIN_EMAIL: emailSchema,
        INITIAL_ADMIN_PASSWORD: newPasswordSchema,
      }),
      input,
    ),
    role: 'initial-setup' as const,
  };
}
export type InitialSetupConfig = ReturnType<typeof parseInitialSetupEnvironment>;
