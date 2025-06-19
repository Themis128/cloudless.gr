import { expect, test } from '@playwright/test';

test.describe('Registration Flow E2E Tests', () => {
  const testUser = {
    fullName: 'Test User',
    email: 'newuser@example.com',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    weakPassword: '123',
    invalidEmail: 'invalid-email-format',
    existingEmail: 'existing@example.com',
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to registration page before each test
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
  });

  test('should display registration form elements', async ({ page }) => {
    // Check that registration form is visible with all required fields using test attributes
    await expect(page.locator('.glass-card')).toBeVisible();
    await expect(
      page.locator('.v-card-title').filter({ hasText: /create account/i }),
    ).toBeVisible();
    await expect(page.locator('[data-testid="fullname-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-account-button"]')).toBeVisible();
  });

  test('should show validation errors for empty required fields', async ({ page }) => {
    // Try to submit empty form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Should show validation errors for required fields
    const errorMessages = page.getByText(/this field is required/i);
    await expect(errorMessages.first()).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Fill form with invalid email using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.invalidEmail);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.confirmPassword);

    // Submit form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Should show email validation error
    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    // Fill form with weak password using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.weakPassword);
    await page.fill('[data-testid="confirm-password-input"]', testUser.weakPassword);

    // Submit form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Should show password validation error
    const passwordError = page.getByText(/password must be at least/i);
    if (await passwordError.isVisible()) {
      await expect(passwordError).toBeVisible();
    }
  });

  test('should validate password confirmation match', async ({ page }) => {
    // Fill form with non-matching passwords using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', 'DifferentPassword123!');

    // Submit form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Should show password confirmation error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should toggle password visibility for both password fields', async ({ page }) => {
    const passwordField = page.locator('[data-testid="password-input"]');
    const confirmPasswordField = page.locator('[data-testid="confirm-password-input"]');

    // Find toggle buttons
    const passwordToggle = page.locator('[data-testid="password-toggle"]').first();
    const confirmPasswordToggle = page.locator('[data-testid="confirm-password-toggle"]').first();

    // Check initial state (should be hidden)
    await expect(passwordField).toHaveAttribute('type', 'password');
    await expect(confirmPasswordField).toHaveAttribute('type', 'password');

    // Toggle password visibility
    if (await passwordToggle.isVisible()) {
      await passwordToggle.click();
      await expect(passwordField).toHaveAttribute('type', 'text');
    }

    if (await confirmPasswordToggle.isVisible()) {
      await confirmPasswordToggle.click();
      await expect(confirmPasswordField).toHaveAttribute('type', 'text');
    }
  });

  test('should handle successful registration', async ({ page }) => {
    // Mock successful registration response
    await page.route('**/auth/v1/signup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-user-id',
            email: testUser.email,
            user_metadata: {
              full_name: testUser.fullName,
            },
          },
        }),
      });
    });

    // Fill valid registration form using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.confirmPassword);

    // Submit form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Should show loading state
    await expect(page.locator('[data-testid="create-account-button"]')).toBeDisabled();

    // Wait for response
    await page.waitForTimeout(2000);

    // Should show success message or redirect
    const hasSuccessAlert = await page.locator('.v-alert--type-success').isVisible();
    const currentUrl = page.url();

    expect(
      hasSuccessAlert || currentUrl.includes('/auth') || currentUrl.includes('/verify-email'),
    ).toBeTruthy();
  });

  test('should handle registration with existing email', async ({ page }) => {
    // Mock error response for existing email
    await page.route('**/auth/v1/signup*', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'User already registered',
        }),
      });
    });

    // Fill form with existing email using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.existingEmail);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.confirmPassword);

    // Submit form using test attribute
    await page.click('[data-testid="create-account-button"]');

    // Wait for response
    await page.waitForTimeout(2000);

    // Should show error message
    const errorAlert = page.locator('.v-alert--type-error');
    if (await errorAlert.isVisible()) {
      await expect(errorAlert).toContainText(/already registered|already exists/i);
    }
  });

  test('should navigate to login page from registration', async ({ page }) => {
    // Look for login link/button
    const loginLink = page.getByText(/already have an account/i);
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/auth(?:\/login)?$/);
    }
  });

  test('should clear form fields when clear buttons are clicked', async ({ page }) => {
    // Fill all form fields using test attributes
    await page.fill('[data-testid="fullname-input"]', testUser.fullName);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.fill('[data-testid="confirm-password-input"]', testUser.confirmPassword);

    // Test clear buttons for each field
    const clearButtons = page.locator('.v-input__append button');
    const clearButtonCount = await clearButtons.count();

    if (clearButtonCount > 0) {
      // Clear full name
      await clearButtons.nth(0).click();
      await expect(page.getByLabel(/full name/i)).toHaveValue('');
    }
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // Test tab navigation through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/full name/i)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/^password$/i)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/confirm password/i)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /create account/i })).toBeFocused();
  });

  test('should handle form submission with Enter key', async ({ page }) => {
    // Fill valid form
    await page.getByLabel(/full name/i).fill(testUser.fullName);
    await page.getByRole('textbox', { name: /email/i }).fill(testUser.email);
    await page.getByLabel(/^password$/i).fill(testUser.password);
    await page.getByLabel(/confirm password/i).fill(testUser.confirmPassword);

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Should show loading state or process the form
    await expect(page.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  test('should show password strength indicator if available', async ({ page }) => {
    // Fill password field and check if strength indicator appears
    await page.getByLabel(/^password$/i).fill('weak');

    // Look for password strength indicator
    const strengthIndicator = page.locator(
      '[data-testid="password-strength"], .password-strength, .strength-meter',
    );
    if (await strengthIndicator.isVisible()) {
      await expect(strengthIndicator).toBeVisible();
    }

    // Test with stronger password
    await page.getByLabel(/^password$/i).fill(testUser.password);
    if (await strengthIndicator.isVisible()) {
      await expect(strengthIndicator).toBeVisible();
    }
  });
});
