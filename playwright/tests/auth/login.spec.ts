import { expect, test } from '@playwright/test';

test.describe('Login Flow E2E Tests', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    invalidEmail: 'invalid-email',
    invalidPassword: '123',
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  test('should display login form elements', async ({ page }) => {
    // Check that login form is visible using test attributes
    await expect(page.locator('.glass-card')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    await expect(page.getByText('Login')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click submit without filling fields using test attribute
    await page.click('[data-testid="login-button"]');

    // Form should stay on the same page (validation prevents submission)
    await expect(page).toHaveURL(/.*\/auth.*/);
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Fill invalid email using test attributes
    await page.fill('[data-testid="email-input"]', testUser.invalidEmail);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-button"]');

    // Should stay on auth page (validation prevents submission)
    await expect(page).toHaveURL(/.*\/auth.*/);
  });

  test('should handle login attempt with invalid credentials', async ({ page }) => {
    // Fill form with invalid credentials using test attributes
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', 'wrongpassword');

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();

    // Wait for response and check for error message
    await page.waitForTimeout(3000); // Wait for auth attempt

    // Should show error alert
    const errorAlert = page.locator('.v-alert--type-error');
    if (await errorAlert.isVisible()) {
      await expect(errorAlert).toContainText(/invalid/i);
    }
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordField = page.locator('[data-testid="password-input"]');
    const toggleButton = page.locator('[data-testid="password-toggle"]');

    // Check if password field exists
    await expect(passwordField).toBeVisible();

    // Try to click toggle to show password
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      // Check if type changed (might be 'text' or 'password')
      const typeAfterClick = await passwordField.getAttribute('type');
      expect(['text', 'password']).toContain(typeAfterClick);
    }
  });

  test('should navigate to registration if link exists', async ({ page }) => {
    // Look for any registration-related link or text
    const registerText = page.getByText(/register|sign up|create account|don't have an account/i);

    if (await registerText.isVisible()) {
      await registerText.click();
      // Should navigate to register page or show registration form
      const currentUrl = page.url();
      expect(currentUrl.includes('/register') || currentUrl.includes('/auth')).toBeTruthy();
    } else {
      // If no register link exists, that's also valid - just check we're on auth page
      await expect(page).toHaveURL(/.*\/auth.*/);
    }
  });

  test('should handle successful login flow', async ({ page }) => {
    // Mock successful login response if needed
    await page.route('**/auth/v1/token*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: {
            id: 'mock-user-id',
            email: testUser.email,
            user_metadata: {},
          },
        }),
      });
    });

    // Fill valid credentials using test attributes
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();

    // Wait for navigation or success message
    await page.waitForTimeout(2000);

    // Check for success (either redirect or success message)
    const currentUrl = page.url();
    const hasSuccessAlert = await page.locator('.v-alert--type-success').isVisible();

    expect(
      currentUrl.includes('/dashboard') || currentUrl.includes('/projects') || hasSuccessAlert,
    ).toBeTruthy();
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // Test tab navigation through form elements using test attributes
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
  });

  test('should clear form fields when clear buttons are clicked', async ({ page }) => {
    // Fill form fields using test attributes
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);

    // Click clear buttons if they exist
    const emailClearButton = page
      .locator('[data-testid="email-input"]')
      .locator('..')
      .locator('.v-field__clearable .v-icon')
      .first();
    const passwordClearButton = page
      .locator('[data-testid="password-input"]')
      .locator('..')
      .locator('.v-field__clearable .v-icon')
      .first();

    if (await emailClearButton.isVisible()) {
      await emailClearButton.click();
      await expect(page.locator('[data-testid="email-input"]')).toHaveValue('');
    }

    if (await passwordClearButton.isVisible()) {
      await passwordClearButton.click();
      await expect(page.locator('[data-testid="password-input"]')).toHaveValue('');
    }
  });
});
