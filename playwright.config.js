import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 20_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    { name: 'base-f0-f3', testMatch: 'ui.spec.js' },
    { name: 'f4-mvp', testMatch: 'f4-mvp.spec.js', dependencies: ['base-f0-f3'] }
  ],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/e2e-server.js',
    url: 'http://127.0.0.1:8788/api/status',
    reuseExistingServer: false,
    timeout: 15_000
  }
});
