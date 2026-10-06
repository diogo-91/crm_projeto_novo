import { Inject, Injectable, Module } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createDatabaseClient } from '@crm/database';
import type { DatabaseClient } from '@crm/database';
import type { DatabaseConfig } from '@crm/config/server';
import { RUNTIME_CONFIG } from '../runtime/index.js';
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: DatabaseClient;
  constructor(@Inject(RUNTIME_CONFIG) config: DatabaseConfig) {
    this.client = createDatabaseClient(config.DATABASE_URL);
  }
  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    await this.ping();
  }
  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
