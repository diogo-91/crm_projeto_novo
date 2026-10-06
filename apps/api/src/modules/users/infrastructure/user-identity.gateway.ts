import { DatabaseService } from '../../database/database.module.js';
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction, Prisma } from '@crm/database';
import type { UserResponse } from '@crm/contracts';
import { ApplicationError } from '../../../common/application-error.js';
const publicIdentity = {
  id: true,
  name: true,
  email: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;
type PublicUser = Prisma.UserGetPayload<{ select: typeof publicIdentity }>;
function response(user: PublicUser): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
@Injectable()
export class UserIdentityGateway {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async publicById(id: string): Promise<UserResponse | undefined> {
    return (await this.findPublicMany(this.database.client, [id])).get(id);
  }
  async create(
    transaction: DatabaseTransaction,
    input: { name: string; email: string },
  ): Promise<UserResponse> {
    const user = await transaction.user.create({
      data: { name: input.name, email: input.email },
      select: publicIdentity,
    });
    return response(user);
  }
  async findActive(transaction: DatabaseTransaction, id: string): Promise<UserResponse> {
    const user = await transaction.user.findUnique({ where: { id }, select: publicIdentity });
    if (!user) throw new ApplicationError('USER_NOT_FOUND', 'User does not exist.');
    if (!user.active)
      throw new ApplicationError('USER_INACTIVE', 'Inactive users cannot receive new memberships.');
    return response(user);
  }
  async findPublicMany(
    transaction: DatabaseTransaction,
    ids: string[],
  ): Promise<ReadonlyMap<string, UserResponse>> {
    const users = await transaction.user.findMany({
      where: { id: { in: ids } },
      select: publicIdentity,
    });
    return new Map(users.map((user) => [user.id, response(user)]));
  }
}
