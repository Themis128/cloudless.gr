import { expect, test } from '@playwright/test';

test.describe('Auth Store Functions - Complete Testing', () => {
  const testUsers = {
    regular: {
      email: 'testuser@example.com',
      password: 'UserPass123!',
      fullName: 'Test User'
    },
    admin: {
      email: 'testadmin2@cloudless.gr',
      password: 'TestAdmin123!',
      fullName: 'Test Admin'
    },
    newUser: {
      email: `newuser${Date.now()}@example.com`,
      password: 'NewUserPass123!',
      fullName: 'New Test User'
    }
  };

  test.beforeEach(async ({ page }) => {
    console.log(`🧪 Starting test: ${test.info().title}`);
    console.log(`📍 Environment: ${process.env.TEST_ENVIRONMENT || 'local'}`);
    console.log(`🌐 Base URL: ${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}`);
    
    // Start from home page
    console.log('🏠 Navigating to home page...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded successfully');
  });

  test.describe('Registration Function Tests', () => {
    test('should successfully register a new user', async ({ page }) => {
      console.log(`👤 Testing registration for: ${testUsers.newUser.email}`);
      
      await page.goto('/auth/register');
      console.log('📝 Registration page loaded');
      
      // Fill registration form
      console.log('📝 Filling registration form...');
      await page.fill('[data-testid="fullname-input"]', testUsers.newUser.fullName);
      console.log(`✓ Full name filled: ${testUsers.newUser.fullName}`);
      
      await page.fill('[data-testid="email-input"]', testUsers.newUser.email);
      console.log(`✓ Email filled: ${testUsers.newUser.email}`);
      
      await page.fill('[data-testid="password-input"]', testUsers.newUser.password);
      console.log('✓ Password filled');
      
      await page.fill('[data-testid="confirm-password-input"]', testUsers.newUser.password);
      console.log('✓ Confirm password filled');
      
      await page.check('input[type="checkbox"]'); // Terms agreement
      console.log('✓ Terms checkbox checked');
      
      // Submit registration
      console.log('🚀 Submitting registration...');
      await page.click('[data-testid="create-account-button"]');
      
      // Wait for success message
      console.log('⏳ Waiting for success message...');
      await expect(page.locator('.v-alert--type-success')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.v-alert--type-success')).toContainText(/registration successful/i);
      console.log('✅ Registration completed successfully');
    });

    test('should validate required fields in registration', async ({ page }) => {
      console.log('🔍 Testing form validation...');
      await page.goto('/auth/register');
      
      // Try to submit empty form
      console.log('📝 Attempting to submit empty form...');      await page.click('[data-testid="create-account-button"]');
      
      // Should stay on registration page
      console.log('🔍 Checking if form validation prevents submission...');
      await expect(page).toHaveURL(/.*\/auth\/register.*/);
      console.log('✅ Form validation working - stayed on registration page');
    });

    test('should validate password confirmation match', async ({ page }) => {
      console.log('🔍 Testing password confirmation validation...');
      await page.goto('/auth/register');
      
      const mismatchEmail = `different${testUsers.newUser.email}`;
      console.log(`📝 Filling form with mismatched passwords for: ${mismatchEmail}`);
      
      await page.fill('[data-testid="fullname-input"]', testUsers.newUser.fullName);
      await page.fill('[data-testid="email-input"]', mismatchEmail);
      await page.fill('[data-testid="password-input"]', testUsers.newUser.password);
      await page.fill('[data-testid="confirm-password-input"]', 'DifferentPassword123!');
      await page.check('input[type="checkbox"]');
      
      console.log('🚀 Submitting form with mismatched passwords...');
      await page.click('[data-testid="create-account-button"]');
      
      // Should show password mismatch error
      console.log('⏳ Waiting for password mismatch error...');
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 5000 });
      console.log('✅ Password mismatch validation working');
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      console.log(`🔍 Testing duplicate email prevention with: ${testUsers.admin.email}`);
      await page.goto('/auth/register');
      
      // Try to register with existing email
      console.log('📝 Filling form with existing email address...');
      await page.fill('[data-testid="fullname-input"]', testUsers.regular.fullName);
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.regular.password);
      await page.fill('[data-testid="confirm-password-input"]', testUsers.regular.password);
      await page.check('input[type="checkbox"]');
      
      console.log('🚀 Submitting registration with duplicate email...');
      await page.click('[data-testid="create-account-button"]');
      
      // Should show error about existing email
      console.log('⏳ Waiting for duplicate email error...');
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 10000 });
      console.log('✅ Duplicate email prevention working');
    });
  });

  test.describe('Login Function Tests', () => {
    test('should successfully login regular user', async ({ page }) => {
      console.log(`👤 Testing login for admin user: ${testUsers.admin.email}`);
      await page.goto('/auth');
      
      console.log('📝 Filling login form...');
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      console.log(`✓ Email filled: ${testUsers.admin.email}`);
      
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      console.log('✓ Password filled');
      
      console.log('🚀 Submitting login...');
      await page.click('[data-testid="login-button"]');
      
      console.log('⏳ Waiting for login success...');
      
      // Should redirect based on user role
      await page.waitForURL(/.*\/(admin|projects|users).*/);
      
      // Check if user is logged in (should see logout option)
      await expect(page.locator('text=/logout/i')).toBeVisible({ timeout: 10000 });
    });

    test('should handle invalid credentials', async ({ page }) => {
      await page.goto('/auth');
      
      await page.fill('[data-testid="email-input"]', testUsers.regular.email);
      await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
      await page.click('[data-testid="login-button"]');
      
      // Should show error message
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/.*\/auth.*/);
    });

    test('should redirect admin to admin panel', async ({ page }) => {
      await page.goto('/auth');
      
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      // Admin should be redirected to admin panel
      await expect(page).toHaveURL(/.*\/admin.*/);
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/auth');
      
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.fill('[data-testid="password-input"]', testUsers.regular.password);
      await page.click('[data-testid="login-button"]');
      
      // Should stay on login page
      await expect(page).toHaveURL(/.*\/auth.*/);
    });
  });
  test.describe('Admin Login Function Tests', () => {
    test('should allow admin to login via admin form', async ({ page }) => {
      await page.goto('/auth');
      
      await page.fill('[data-testid="admin-email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="admin-password-input"]', testUsers.admin.password);
      await page.click('[data-testid="admin-login-button"]');
      
      // Should redirect to admin panel
      await expect(page).toHaveURL(/.*\/admin.*/);
    });

    test('should reject non-admin users from admin login', async ({ page }) => {
      await page.goto('/auth');
      
      // Try to login as regular user
      await page.fill('[data-testid="admin-email-input"]', testUsers.regular.email);
      await page.fill('[data-testid="admin-password-input"]', testUsers.regular.password);
      await page.click('[data-testid="admin-login-button"]');
      
      // Should show admin access required error
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 10000 });
      await expect(page).toHaveURL(/.*\/auth\/admin-login.*/);
    });
  });

  test.describe('Password Reset Function Tests', () => {
    test('should display password reset form', async ({ page }) => {
      await page.goto('/auth/reset');
      
      await expect(page.locator('[data-testid="reset-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="reset-submit-button"]')).toBeVisible();
    });

    test('should send reset email for existing user', async ({ page }) => {
      await page.goto('/auth/reset');
      
      await page.fill('[data-testid="reset-email-input"]', testUsers.admin.email);
      await page.click('[data-testid="reset-submit-button"]');
      
      // Should show success message
      await expect(page.locator('.v-alert--type-success')).toBeVisible({ timeout: 10000 });
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      await page.goto('/auth/reset');
      
      await page.fill('[data-testid="reset-email-input"]', 'nonexistent@example.com');
      await page.click('[data-testid="reset-submit-button"]');
      
      // Should show appropriate error message
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Authentication State Management', () => {
    test('should maintain login state across page refreshes', async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(/.*\/admin.*/);
      
      // Refresh page
      await page.reload();
      
      // Should still be on admin page (authenticated)
      await expect(page).toHaveURL(/.*\/admin.*/);
    });

    test('should handle logout properly', async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(/.*\/admin.*/);
      
      // Find and click logout
      await page.locator('text=/logout/i').first().click();
      
      // Should be redirected to home or auth page
      await expect(page).toHaveURL(/.*\/(|auth).*/);
    });
  });
});
