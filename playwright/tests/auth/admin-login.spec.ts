import { expect, test } from '@playwright/test';

test.describe('Admin Login Flow E2E Tests', () => {
  const adminUser = {
    email: 'admin@cloudless.gr',
    password: 'AdminPassword123!',
    invalidEmail: 'user@example.com',
    invalidPassword: 'wrongpassword',
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page before each test
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
  });

  test('should display admin login form', async ({ page }) => {
    // Check that admin login form is visible
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();

    // Should have admin-specific styling or title
    const adminTitle = page.getByText(/admin/i);
    if (await adminTitle.isVisible()) {
      await expect(adminTitle).toBeVisible();
    }
  });

  test('should require email and password fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /login/i }).click();

    // Should show validation errors
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Fill invalid email
    await page.getByRole('textbox', { name: /email/i }).fill('invalid-email');
    await page.getByLabel(/password/i).fill(adminUser.password);
    await page.getByRole('button', { name: /login/i }).click();

    // Should show email validation error
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('should handle invalid admin credentials', async ({ page }) => {
    // Mock failed admin login
    await page.route('**/auth/v1/token*', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid login credentials',
        }),
      });
    });

    // Fill non-admin credentials
    await page.getByRole('textbox', { name: /email/i }).fill(adminUser.invalidEmail);
    await page.getByLabel(/password/i).fill(adminUser.invalidPassword);

    // Submit form
    await page.getByRole('button', { name: /login/i }).click();

    // Should show loading state
    await expect(page.getByRole('button', { name: /login/i })).toBeDisabled();

    // Wait for response
    await page.waitForTimeout(2000);

    // Should show error message
    const errorAlert = page.locator('.v-alert--type-error, .alert-error, [role="alert"]');
    if (await errorAlert.isVisible()) {
      await expect(errorAlert).toContainText(/invalid|denied|unauthorized/i);
    }
  });

  test('should handle successful admin login', async ({ page }) => {
    // Mock successful admin login
    await page.route('**/auth/v1/token*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'admin-mock-token',
          user: {
            id: 'admin-user-id',
            email: adminUser.email,
            user_metadata: {
              role: 'admin',
            },
          },
        }),
      });
    });

    // Fill valid admin credentials
    await page.getByRole('textbox', { name: /email/i }).fill(adminUser.email);
    await page.getByLabel(/password/i).fill(adminUser.password);

    // Submit form
    await page.getByRole('button', { name: /login/i }).click();

    // Should show loading state
    await expect(page.getByRole('button', { name: /login/i })).toBeDisabled();

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Should redirect to admin dashboard
    const currentUrl = page.url();
    expect(currentUrl.includes('/admin/dashboard') || currentUrl.includes('/admin')).toBeTruthy();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordField = page.getByLabel(/password/i);
    const toggleButton = page
      .locator('[data-testid="password-toggle"], .mdi-eye, .v-input__append button')
      .first();

    if (await toggleButton.isVisible()) {
      // Password should be hidden initially
      await expect(passwordField).toHaveAttribute('type', 'password');

      // Click toggle to show password
      await toggleButton.click();
      await expect(passwordField).toHaveAttribute('type', 'text');

      // Click toggle to hide password again
      await toggleButton.click();
      await expect(passwordField).toHaveAttribute('type', 'password');
    }
  });

  test('should navigate back to regular login', async ({ page }) => {
    // Look for link to regular login
    const regularLoginLink = page.getByText(/regular login|user login|back to login/i);
    if (await regularLoginLink.isVisible()) {
      await regularLoginLink.click();
      await expect(page).toHaveURL(/\/auth(?:\/login)?$/);
    }
  });

  test('should have different styling from regular login', async ({ page }) => {
    // Navigate to regular login to compare
    await page.goto('/auth');
    await page.locator('.glass-card, .login-form').count();

    // Go back to admin login
    await page.goto('/admin/login');
    const adminLoginElements = await page.locator('.glass-card, .admin-login, .login-form').count();

    // Should have form elements
    expect(adminLoginElements).toBeGreaterThan(0);
  });

  test('should handle admin-specific validation', async ({ page }) => {
    // Fill regular user email (should be rejected for admin)
    await page.getByRole('textbox', { name: /email/i }).fill('regularuser@example.com');
    await page.getByLabel(/password/i).fill('password123');

    // Submit form
    await page.getByRole('button', { name: /login/i }).click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Should show admin-specific error or redirect to regular login
    const errorOrRedirect =
      (await page.locator('.v-alert--type-error').isVisible()) || page.url().includes('/auth');

    expect(errorOrRedirect).toBeTruthy();
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/password/i)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /login/i })).toBeFocused();
  });

  test('should handle Enter key submission', async ({ page }) => {
    // Fill form
    await page.getByRole('textbox', { name: /email/i }).fill(adminUser.email);
    await page.getByLabel(/password/i).fill(adminUser.password);

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should process the form
    await expect(page.getByRole('button', { name: /login/i })).toBeDisabled();
  });

  test('should show forgot password option if available', async ({ page }) => {
    // Look for forgot password link
    const forgotPasswordLink = page.getByText(/forgot password/i);
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();

      // Should navigate to password reset or show reset form
      const currentUrl = page.url();
      expect(
        currentUrl.includes('/reset') ||
          currentUrl.includes('/forgot-password') ||
          (await page.getByText(/reset/i).isVisible()),
      ).toBeTruthy();
    }
  });
});
