import { defineConfig } from 'prisma/config';
import { parseDatabaseEnvironment } from '@crm/config/server';
const config = parseDatabaseEnvironment(process.env);
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'pnpm --filter @crm/api seed:run' },
  datasource: { url: config.DATABASE_URL },
});
