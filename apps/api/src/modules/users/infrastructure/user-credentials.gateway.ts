import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@crm/database';
import { DatabaseService } from '../../database/database.module.js';
export type Credential = {
  id: string;
  passwordHash: string | null;
  securityVersion: number;
  active: boolean;
};
const credential = { id: true, passwordHash: true, securityVersion: true, active: true } as const;
@Injectable()
export class UserCredentialsGateway {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  byEmail(email: string): Promise<Credential | null> {
    return this.database.client.user.findUnique({ where: { email }, select: credential });
  }
  byId(
    id: string,
    transaction: DatabaseTransaction = this.database.client,
  ): Promise<Credential | null> {
    return transaction.user.findUnique({ where: { id }, select: credential });
  }
  async replacePassword(
    transaction: DatabaseTransaction,
    snapshot: Credential,
    passwordHash: string,
  ): Promise<{ count: number }> {
    return transaction.user.updateMany({
      where: {
        id: snapshot.id,
        active: true,
        passwordHash: snapshot.passwordHash,
        securityVersion: snapshot.securityVersion,
      },
      data: { passwordHash, securityVersion: { increment: 1 } },
    });
  }
  async invalidate(transaction: DatabaseTransaction, id: string) {
    await transaction.user.update({ where: { id }, data: { securityVersion: { increment: 1 } } });
  }
  async createInitialAdministrator(
    transaction: DatabaseTransaction,
    input: { name: string; email: string },
    passwordHash: string,
  ) {
    if ((await transaction.user.count()) !== 0)
      throw new Error('Initial setup requires an empty installation');
    const user = await transaction.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true },
    });
    return user.id;
  }
  async seed(transaction: DatabaseTransaction, email: string, passwordHash: string) {
    const user = await transaction.user.upsert({
      where: { email },
      create: { name: 'Administrador Demo', email, passwordHash },
      update: {},
    });
    if (user.passwordHash === null)
      await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
    return user.id;
  }
}
