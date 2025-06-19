// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright/tests',
  timeout: 30000,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Global test setup
  globalSetup: './playwright/global-setup.ts',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    video: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Add authentication for tests that require it
    storageState: process.env.STORAGE_STATE,
  },

  // Test patterns and organization
  testMatch: ['**/*.spec.ts', '**/*.e2e.ts', '**/*.test.ts'],
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: 'playwright/results/html', open: process.env.CI ? 'never' : 'on-failure' },
    ],
    ['junit', { outputFile: 'playwright/results/results.xml' }],
    ['json', { outputFile: 'playwright/results/results.json' }],
  ],

  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },

    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.ts/,
    },

    // Authentication tests (run first)
    {
      name: 'auth-tests',
      testDir: './playwright/tests/auth',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Main application tests
    {
      name: 'chromium',
      testIgnore: ['**/auth/**'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox testing (optional, can be disabled for faster CI)
    {
      name: 'firefox',
      testIgnore: ['**/auth/**'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'] },
    },

    // Mobile testing
    {
      name: 'mobile-chrome',
      testIgnore: ['**/auth/**'],
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'] },
    },

    // Safari testing (for cross-browser compatibility)
    {
      name: 'webkit',
      testIgnore: ['**/auth/**'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Development server configuration
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },

  // Output directories
  outputDir: 'playwright/test-results',

  // Expect options
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      scale: 'css',
      animations: 'disabled',
    },
  },
});
