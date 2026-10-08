import { existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
// Next's standalone server requires its static assets beside the traced app.
const app = resolve(import.meta.dirname, '../apps/web');
const packaged = resolve(app, '.next/standalone/apps/web');
await mkdir(resolve(packaged, '.next'), { recursive: true });
await cp(resolve(app, '.next/static'), resolve(packaged, '.next/static'), { recursive: true });
if (existsSync(resolve(app, 'public')))
  await cp(resolve(app, 'public'), resolve(packaged, 'public'), { recursive: true });
