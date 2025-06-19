/**
 * Playwright Global Setup
 * Handles authentication setup and other global configurations for E2E tests
 */

import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up Playwright global configuration...');

  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the application to be ready
    if (baseURL) {
      console.log(`📍 Checking if application is running on ${baseURL}`);
      await page.goto(baseURL);
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('✅ Application is running and accessible');
    }

    // Setup authenticated user state for tests that need it
    if (storageState) {
      console.log('🔐 Setting up authenticated user state...');

      // Mock authentication for testing
      await page.addInitScript(() => {
        localStorage.setItem(
          'supabase.auth.token',
          JSON.stringify({
            access_token: 'playwright-test-token',
            refresh_token: 'playwright-refresh-token',
            user: {
              id: 'playwright-test-user-id',
              email: 'playwright@test.com',
              user_metadata: {
                full_name: 'Playwright Test User',
              },
              created_at: new Date().toISOString(),
            },
          }),
        );
      });

      // Navigate to a protected route to trigger auth check
      await page.goto(`${baseURL}/settings`);
      await page.waitForTimeout(2000);

      // Save authentication state
      await page.context().storageState({ path: storageState as string });
      console.log('✅ Authentication state saved');
    }

    console.log('🎉 Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
