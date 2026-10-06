import { defineConfig, mergeConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import base from './vitest.config.mts';
export default mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
    test: {
      environment: 'jsdom',
      setupFiles: [fileURLToPath(new URL('./tests/frontend-setup.ts', import.meta.url))],
    },
  }),
);
