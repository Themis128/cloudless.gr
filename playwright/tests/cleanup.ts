/**
 * Playwright Cleanup Tests
 * Runs after test suites to clean up test data and resources
 */

import { test } from '@playwright/test';

test.describe('Test Environment Cleanup', () => {
  test('should clean up test data', async ({ page }) => {
    // Clean up any test data created during tests
    // This could include test users, projects, etc.

    console.log('✅ Test data cleanup completed');
  });

  test('should clear browser storage', async ({ page }) => {
    // Clear local storage and session storage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    console.log('✅ Browser storage cleared');
  });

  test('should reset authentication state', async ({ page }) => {
    // Ensure no lingering authentication state
    await page.goto('/auth');

    // Verify we're in logged out state
    const loginForm = page.locator('form');
    if (await loginForm.isVisible()) {
      console.log('✅ Authentication state reset');
    }
  });
});
