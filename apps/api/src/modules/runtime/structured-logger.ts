import pino from 'pino';
import type { DestinationStream, Level, Logger } from 'pino';
import type { LoggerService } from '@nestjs/common';
type LogFields = {
  userId?: string;
  sessionId?: string;
  membershipId?: string;
  organizationId?: string;
  entityId?: string;
  requestId?: string;
  correlationId?: string;
  statusCode?: number;
  durationMs?: number;
  method?: string;
  jobId?: string;
  errorType?: string;
  signal?: string;
};
export class StructuredLogger implements LoggerService {
  private readonly logger: Logger;
  constructor(service: string, level: Level = 'info', destination?: DestinationStream) {
    const options = {
      name: service,
      level,
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: (label: string) => ({ level: label }) },
      redact: [
        'password',
        'passwordHash',
        'currentPassword',
        'newPassword',
        'refreshToken',
        'accessToken',
        'JWT_SECRET',
        'SEED_ADMIN_PASSWORD',
        'token',
        'secret',
        'DATABASE_URL',
        'REDIS_PASSWORD',
        'headers.authorization',
        'headers.cookie',
      ],
    };
    this.logger = destination ? pino(options, destination) : pino(options);
  }
  private message(value: unknown): string {
    if (value instanceof Error) return value.name;
    if (typeof value !== 'string') return 'structured event';
    return value.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED_DATABASE_URL]');
  }
  info(message: string, context: string, fields: LogFields = {}): void {
    this.logger.info({ context, ...fields }, this.message(message));
  }
  warn(message: unknown, context = 'runtime'): void {
    this.logger.warn({ context }, this.message(message));
  }
  error(message: unknown): void {
    this.logger.error({ context: 'runtime' }, this.message(message));
  }
  log(message: unknown, context = 'Nest'): void {
    this.info(this.message(message), context);
  }
  debug(message: unknown, context = 'runtime'): void {
    this.logger.debug({ context }, this.message(message));
  }
  verbose(message: unknown, context = 'runtime'): void {
    this.logger.trace({ context }, this.message(message));
  }
  fatal(message: unknown, context = 'runtime'): void {
    this.logger.fatal({ context }, this.message(message));
  }
}
export function reportStartupFailure(service: string, error: unknown): void {
  const logger = new StructuredLogger(service);
  const message =
    error instanceof Error && error.message.startsWith('Invalid environment configuration:')
      ? error.message
      : 'startup failed; verify configuration and infrastructure';
  logger.fatal(message, 'bootstrap');
  process.exitCode = 1;
}
