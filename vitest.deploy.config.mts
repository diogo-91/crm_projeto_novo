import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.deploy.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 900000,
    testTimeout: 120000,
  },
});
