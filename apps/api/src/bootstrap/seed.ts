import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseSeedEnvironment } from '@crm/config/server';
import type { SeedConfig } from '@crm/config/server';
import { RUNTIME_CONFIG, LoggingModule, StructuredLogger } from '../modules/runtime/index.js';
import { reportStartupFailure } from '../modules/runtime/structured-logger.js';
import { DatabaseModule, DatabaseService } from '../modules/database/database.module.js';
import { UsersModule, UserCredentialsGateway } from '../modules/users/index.js';
import {
  OrganizationsContextModule,
  OrganizationsAccessGateway,
} from '../modules/organizations/index.js';
import { AccessControlModule, AccessBootstrapGateway } from '../modules/access-control/index.js';
import { PasswordModule, PasswordService } from '../modules/auth/password.module.js';
@Global()
@Module({
  providers: [{ provide: RUNTIME_CONFIG, useFactory: () => parseSeedEnvironment(process.env) }],
  exports: [RUNTIME_CONFIG],
})
class SeedConfigModule {}
@Module({
  imports: [
    SeedConfigModule,
    LoggingModule,
    DatabaseModule,
    UsersModule,
    OrganizationsContextModule,
    AccessControlModule,
    PasswordModule,
  ],
})
class SeedModule {}
async function seed() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const config = app.get<SeedConfig>(RUNTIME_CONFIG);
    const passwordHash = await app.get(PasswordService).hash(config.SEED_ADMIN_PASSWORD);
    await app.get(DatabaseService).client.$transaction(
      async (transaction) => {
        const userId = await app
          .get(UserCredentialsGateway)
          .seed(transaction, config.SEED_ADMIN_EMAIL, passwordHash);
        const member = await app.get(OrganizationsAccessGateway).seed(transaction, userId);
        await app
          .get(AccessBootstrapGateway)
          .provision(transaction, member.organizationId, member.membershipId);
        if (config.SEED_PLATFORM_PROVISIONING)
          await app.get(AccessBootstrapGateway).platformSeed(transaction, userId);
      },
      { timeout: 10000 },
    );
    app.get(StructuredLogger).info('development seed completed', 'seed');
  } finally {
    await app.close();
  }
}
seed().catch((error: unknown) => reportStartupFailure('seed', error));
