import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ApiConfig } from '@crm/config/server';
import type { Response } from 'express';
import { emailSchema } from '@crm/contracts';
import { RUNTIME_CONFIG, RedisService, StructuredLogger } from '../../runtime/index.js';
import { ApplicationError } from '../../../common/application-error.js';
export function rateKey(kind: string, value: string) {
  return `auth:rate:${kind}:${createHash('sha256').update(value).digest('hex')}`;
}
@Injectable()
export class AuthRateService {
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: ApiConfig,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async consume(kind: 'login' | 'refresh', ip: string, body: unknown, response: Response) {
    const limits = [
      {
        key: rateKey(`${kind}:ip`, ip),
        limit:
          kind === 'login' ? this.config.AUTH_LOGIN_IP_LIMIT : this.config.AUTH_REFRESH_IP_LIMIT,
        window: 60000,
      },
    ];
    if (kind === 'login' && typeof body === 'object' && body !== null && 'email' in body) {
      const email = emailSchema.safeParse(body.email);
      if (email.success)
        limits.push({
          key: rateKey('login:identity', `${ip}:${email.data}`),
          limit: this.config.AUTH_LOGIN_IDENTITY_LIMIT,
          window: 300000,
        });
    }
    for (const item of limits) {
      let result: { count: number; ttlMs: number };
      try {
        result = await this.redis.consumeRate(item.key, item.window);
      } catch (error: unknown) {
        this.logger.error(error);
        throw new ApplicationError('AUTH_UNAVAILABLE', 'Authentication throttling unavailable.');
      }
      if (result.count > item.limit) {
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil(result.ttlMs / 1000))));
        throw new ApplicationError('RATE_LIMITED', 'Too many authentication attempts.');
      }
    }
  }
}
