import { Inject, Injectable, Module } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { RuntimeConfig } from '@crm/config/server';
import { RUNTIME_CONFIG } from './config.module.js';
import { StructuredLogger } from './structured-logger.js';
export function redisConnectionOptions(config: RuntimeConfig, mode: 'request' | 'blocking') {
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
    connectTimeout: 2000,
    retryStrategy: (attempt: number) => Math.min(attempt * 100, 2000),
    maxRetriesPerRequest: mode === 'blocking' ? null : 1,
    ...(mode === 'request' ? { commandTimeout: 2000 } : {}),
  } satisfies RedisOptions;
}
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  constructor(
    @Inject(RUNTIME_CONFIG) config: RuntimeConfig,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {
    this.client = new Redis({ ...redisConnectionOptions(config, 'request'), lazyConnect: true });
    this.client.on('error', () => this.logger.warn('Redis connection error', 'redis'));
  }
  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.ping();
    } catch (error: unknown) {
      this.client.disconnect();
      throw error;
    }
  }
  async consumeRate(key: string, windowMs: number): Promise<{ count: number; ttlMs: number }> {
    const result: unknown = await this.client.eval(
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return {n, redis.call('PTTL', KEYS[1])}",
      1,
      key,
      String(windowMs),
    );
    if (
      !Array.isArray(result) ||
      typeof result[0] !== 'number' ||
      typeof result[1] !== 'number' ||
      result[1] < 0
    )
      throw new Error('Invalid Redis rate-limit result');
    return { count: result[0], ttlMs: result[1] };
  }
  async ping(): Promise<void> {
    const result = await this.client.ping();
    if (result !== 'PONG') throw new Error('Redis did not acknowledge PING');
  }
  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.status === 'ready') await this.client.quit();
    } finally {
      this.client.disconnect();
    }
  }
}
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
