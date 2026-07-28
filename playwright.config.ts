/// <reference types="vitest" />
import { defineConfig } from '@playwright/test';
import { vi } from 'vitest';

// Import the AWS mock setup from global-setup.ts
import './e2e/global-setup';

// Define the Cloudflare base URL for tests
const CLOUDFLARE_BASE_URL = process.env.CLOUDFLARE_BASE_URL || 'https://cloudless.gr';

// Define the AWS base URL for fallback (should not be used in production tests)
// const AWS_BASE_URL = 'https://legacy-aws-endpoint.example.com';

// Playwright configuration
export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.FORBID_ONLY,
  retries: process.env.RETRIES ? Number(process.env.RETRIES) : 2,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  reporter: 'html',
  use: {
    baseURL: CLOUDFLARE_BASE_URL,
    trace: 'on-first-retry',
    // Mock AWS SDK calls during tests
    mock: {
      // Mock AWS SDK clients to prevent test failures
      '@aws-sdk/client-s3': 'aws-sdk-mock',
      '@aws-sdk/client-cognito-identity-provider': 'aws-sdk-mock',
      '@aws-sdk/client-bedrock-runtime': 'aws-sdk-mock',
      '@aws-sdk/client-sesv2': 'aws-sdk-mock',
      '@aws-sdk/client-ssm': 'aws-sdk-mock',
      '@aws-sdk/client-dynamodb': 'aws-sdk-mock',
      '@aws-sdk/client-athena': 'aws-sdk-mock',
      '@aws-sdk/client-cloudwatch': 'aws-sdk-mock',
      '@aws-sdk/client-lambda': 'aws-sdk-mock',
      '@aws-sdk/client-iam': 'aws-sdk-mock',
    },
    // Override any fetch calls to redirect AWS endpoints to Cloudflare equivalents
    serverFilters: [
      async ({ request, params, logger }) => {
        const url = new URL(request.url);
        // Redirect AWS S3 endpoints to Cloudflare R2
        if (url.hostname.includes('s3.amazonaws.com')) {
          const cloudflareR2Endpoint = `https://${process.env.CLOUDFLARE_R2_BUCKET}.r2.cloudflarestorage.com`;
          const newUrl = new URL(url.pathname, cloudflareR2Endpoint);
          logger.warn(`Redirecting S3 request to R2: ${request.url} -> ${newUrl}`);
          return { url: newUrl, headers: request.headers };
        }
        // Redirect other AWS endpoints to Cloudflare equivalents
        if (url.hostname.includes('aws.amazon.com')) {
          const target = url.pathname.replace(/^\/api\//, '/');
          const newUrl = new URL(target, 'https://cloudless.gr');
          logger.warn(`Redirecting AWS endpoint to Cloudflare: ${request.url} -> ${newUrl}`);
          return { url: newUrl, headers: request.headers };
        }
        return null;
      },
    ],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['desktopChrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['desktopFirefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['desktopSafari'] },
    },
  ],
  // Test timeout adjustments for Cloudflare network latency
  timeout: process.env.TEST_TIMEOUT ? Number(process.env.TEST_TIMEOUT) : 30000,
  // Retry on failure
  retriesOnFail: true,
  // Setup environment variables for AWS to Cloudflare migration
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
});
</final_file_content>
<task_progress>
- [x] Create playwright.config.ts with Cloudflare base URL configuration
- [x] Reference AWS mock setup from global-setup.ts
- [x] Add serverFilters to redirect AWS endpoints to Cloudflare equivalents
- [x] Configure test timeout and retry settings for Cloudflare network
- [x] Set up projects for Chromium, Firefox, and WebKit browsers
- [ ] Restart test runner to load new configuration
</task_progress>
</write_to_file>