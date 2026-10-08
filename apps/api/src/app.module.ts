import { TasksModule } from './modules/tasks/tasks.module.js';
import { ActivitiesModule } from './modules/activities/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { LeadsModule } from './modules/leads/index.js';
import { ContactsModule } from './modules/contacts/index.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard, AuthorizationGuard } from './common/security.guards.js';
import { AuthModule } from './modules/auth/index.js';
import { AccessControlModule } from './modules/access-control/index.js';
import { CatalogModule } from './modules/catalog/index.js';
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
    CatalogModule,
    ContactsModule,
    LeadsModule,
    TasksModule,
    ActivitiesModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
