import { Inject, Injectable } from '@nestjs/common';
import { healthResponseSchema } from '@crm/contracts';
import type { HealthResponse } from '@crm/contracts';
import { DatabaseService } from '../database/database.module.js';
import { RedisService, StructuredLogger } from '../runtime/index.js';
@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  private async check(name: string, ping: () => Promise<void>): Promise<'up' | 'down'> {
    try {
      await ping();
      return 'up';
    } catch (error: unknown) {
      this.logger.info('dependency unavailable', name, {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return 'down';
    }
  }
  async readiness(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.check('database', () => this.database.ping()),
      this.check('redis', () => this.redis.ping()),
    ]);
    return healthResponseSchema.parse({
      status: database === 'up' && redis === 'up' ? 'ok' : 'unavailable',
      services: { database, redis },
    });
  }
}
