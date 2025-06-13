import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the welcome message', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome to Cloudless GR')).toBeVisible();
  });
});
