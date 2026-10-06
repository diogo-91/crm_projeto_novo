import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard, AuthorizationGuard } from './common/security.guards.js';
import { AuthModule } from './modules/auth/index.js';
import { AccessControlModule } from './modules/access-control/index.js';
import { Module } from '@nestjs/common';
import { RuntimeConfigModule, LoggingModule, QueueModule } from './modules/runtime/index.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
@Module({
  imports: [
    RuntimeConfigModule.forRoot('api'),
    LoggingModule,
    HealthModule,
    QueueModule,
    OrganizationsModule,
    AuthModule,
    AccessControlModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
