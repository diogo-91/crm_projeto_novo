import type { NextConfig } from 'next';
import { parseWebEnvironment } from '@crm/config/web';
parseWebEnvironment({ NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'] });
const config: NextConfig = {
  agentRules: false,
  experimental: { strictRouteTypes: true },
  transpilePackages: ['@crm/ui'],
};
export default config;
