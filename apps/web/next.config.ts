import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import { parseWebEnvironment } from '@crm/config/web';
parseWebEnvironment({ NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'] });
const config: NextConfig = {
  agentRules: false,
  output: 'standalone',
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  experimental: { strictRouteTypes: true },
  transpilePackages: ['@crm/ui'],
};
export default config;
