import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '@crm/contracts';
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
  return { ...parse(common, input), role: 'worker' as const };
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
        LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
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
