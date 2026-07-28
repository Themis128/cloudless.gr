import { devices } from '@playwright/test';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['e2e/global-setup.ts'],
    teardownFiles: ['e2e/global-teardown.ts'],
    testDir: './e2e',
    timeout: 10000,
    reporter: [
      ['line'],
      ['html', { open: 'never' }],
    ],
  },
  e2e: {
    use: {
      ...devices['Desktop Chrome'],
      baseURL: 'http://localhost:3000',
    },
    webServer: {
      command: 'pnpm dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  },
});