import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']
      ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'] }
      : {},
  },
  webServer: {
    command: 'node scripts/browser-environment.mjs',
    url: 'http://localhost:3000/login',
    reuseExistingServer: false,
    timeout: 120000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 30000 },
  },
});
