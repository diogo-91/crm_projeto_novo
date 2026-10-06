import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../runtime/index.js';
import { UsersModule } from '../users/index.js';
import { OrganizationsContextModule } from '../organizations/index.js';
import { AccessControlModule } from '../access-control/index.js';
import { PasswordModule } from './password.module.js';
import { TokenService } from './infrastructure/token.service.js';
import { SessionRepository } from './infrastructure/session.repository.js';
import { AuthService } from './application/auth.service.js';
import { AuthRateService } from './application/auth-rate.service.js';
import { AuthController } from './presentation/auth.controller.js';
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    UsersModule,
    OrganizationsContextModule,
    AccessControlModule,
    PasswordModule,
  ],
  providers: [TokenService, SessionRepository, AuthService, AuthRateService],
  controllers: [AuthController],
  exports: [AuthService, AuthRateService],
})
export class AuthModule {}
