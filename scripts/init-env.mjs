import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../.env', import.meta.url);
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
const databasePassword = randomBytes(32).toString('hex');
const redisPassword = randomBytes(32).toString('hex');
const jwtSecret = randomBytes(32).toString('base64url');
const seedPassword = randomBytes(24).toString('base64url');
const content = template
  .replace(/^JWT_SECRET=$/m, `JWT_SECRET=${jwtSecret}`)
  .replace(/^SEED_ADMIN_PASSWORD=$/m, `SEED_ADMIN_PASSWORD=${seedPassword}`)
  .replace(/^POSTGRES_PASSWORD=$/m, `POSTGRES_PASSWORD=${databasePassword}`)
  .replace(/^REDIS_PASSWORD=$/m, `REDIS_PASSWORD=${redisPassword}`)
  .replace(
    /^DATABASE_URL=$/m,
    `DATABASE_URL=postgresql://crm:${databasePassword}@127.0.0.1:5432/crm`,
  );
await writeFile(file, content, { flag: 'wx', mode: 0o600 });
console.info(
  '.env criado com credenciais aleatórias locais. Nenhum arquivo existente foi sobrescrito.',
);
