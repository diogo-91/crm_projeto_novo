import { DatabaseModule } from '../database/database.module.js';
import { UserCredentialsGateway } from './infrastructure/user-credentials.gateway.js';
import { Module } from '@nestjs/common';
import { UserIdentityGateway } from './infrastructure/user-identity.gateway.js';
@Module({
  imports: [DatabaseModule],
  providers: [UserIdentityGateway, UserCredentialsGateway],
  exports: [UserIdentityGateway, UserCredentialsGateway],
})
export class UsersModule {}
