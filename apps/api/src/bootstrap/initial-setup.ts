import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseInitialSetupEnvironment } from '@crm/config/server';
import type { InitialSetupConfig } from '@crm/config/server';
import {
  RUNTIME_CONFIG,
  LoggingModule,
  StructuredLogger,
  reportStartupFailure,
} from '../modules/runtime/index.js';
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
  providers: [
    { provide: RUNTIME_CONFIG, useFactory: () => parseInitialSetupEnvironment(process.env) },
  ],
  exports: [RUNTIME_CONFIG],
})
class InitialSetupConfigModule {}

@Module({
  imports: [
    InitialSetupConfigModule,
    LoggingModule,
    DatabaseModule,
    UsersModule,
    OrganizationsContextModule,
    AccessControlModule,
    PasswordModule,
  ],
})
class InitialSetupModule {}

async function initialize(): Promise<void> {
  const app = await NestFactory.createApplicationContext(InitialSetupModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const config = app.get<InitialSetupConfig>(RUNTIME_CONFIG);
    const passwordHash = await app.get(PasswordService).hash(config.INITIAL_ADMIN_PASSWORD);
    const organizations = app.get(OrganizationsAccessGateway);
    const result = await app.get(DatabaseService).client.$transaction(
      async (transaction) => {
        await organizations.lockEmptyInstallation(transaction);
        const userId = await app.get(UserCredentialsGateway).createInitialAdministrator(
          transaction,
          {
            name: config.INITIAL_ADMIN_NAME,
            email: config.INITIAL_ADMIN_EMAIL,
          },
          passwordHash,
        );
        const member = await organizations.createInitialOrganization(transaction, userId, {
          organizationName: config.INITIAL_ORGANIZATION_NAME,
          branchName: config.INITIAL_BRANCH_NAME,
          branchCode: config.INITIAL_BRANCH_CODE,
        });
        await app
          .get(AccessBootstrapGateway)
          .provision(transaction, member.organizationId, member.membershipId);
        return member;
      },
      { timeout: 15000, maxWait: 5000 },
    );
    app.get(StructuredLogger).info('initial organization provisioned', 'initial-setup', result);
  } finally {
    await app.close();
  }
}
initialize().catch((error: unknown) => reportStartupFailure('initial-setup', error));
