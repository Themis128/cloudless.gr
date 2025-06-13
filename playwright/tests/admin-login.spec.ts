import { test, expect } from '@playwright/test';

test.describe('Admin Login', () => {
  test('should display the admin login form', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('form')).toBeVisible();
  });
});
