import type { Prisma as PrismaTypes } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
export function createDatabaseClient(databaseUrl: string) {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 2000,
    statement_timeout: 2000,
    query_timeout: 2000,
  });
  return new PrismaClient({ adapter });
}
export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export { Prisma } from './generated/prisma/client.js';
export type { PrismaClient } from './generated/prisma/client.js';

export type DatabaseTransaction = PrismaTypes.TransactionClient;
