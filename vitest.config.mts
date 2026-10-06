import { defineConfig } from 'vitest/config';
import { transform } from '@swc/core';
export default defineConfig({
  plugins: [
    {
      name: 'swc-typescript-metadata',
      enforce: 'pre',
      async transform(code, id) {
        if (!/\.tsx?$/.test(id) || id.includes('/node_modules/')) return null;
        return transform(code, {
          filename: id,
          sourceMaps: true,
          jsc: {
            parser: { syntax: 'typescript', decorators: true, tsx: id.endsWith('.tsx') },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
              react: { runtime: 'automatic' },
            },
            target: 'es2024',
          },
          module: { type: 'es6' },
        });
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    maxWorkers: 2,
    testTimeout: 10000,
  },
});
