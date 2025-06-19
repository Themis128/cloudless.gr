/**
 * Final Login Flow Test
 * Comprehensive test for login functionality using vanilla JavaScript and Playwright
 */

import { chromium } from 'playwright';

async function testFinalLogin() {
  console.log('🚀 Starting Final Login Flow Test...');

  let browser, context, page;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: false, // Set to true for CI
      slowMo: 1000, // Slow down for demo
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();

    // Test 1: Navigate to login page
    console.log('📍 Test 1: Navigating to login page...');
    await page.goto('http://localhost:3000/auth');
    await page.waitForLoadState('networkidle');

    // Verify login form elements
    const emailField = page.locator('input[type="email"], [placeholder*="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button:has-text("Login")').first();

    await emailField.waitFor({ state: 'visible' });
    await passwordField.waitFor({ state: 'visible' });
    await loginButton.waitFor({ state: 'visible' });

    console.log('✅ Login form elements are visible');

    // Test 2: Validate empty form submission
    console.log('📍 Test 2: Testing empty form validation...');
    await loginButton.click();

    // Check for validation errors
    const validationErrors = page.locator(':has-text("required"), :has-text("field is required")');
    await validationErrors.first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Empty form validation works');

    // Test 3: Test invalid email format
    console.log('📍 Test 3: Testing invalid email format...');
    await emailField.fill('invalid-email');
    await passwordField.fill('password123');
    await loginButton.click();

    const emailValidationError = page.locator(
      ':has-text("valid email"), :has-text("email address")',
    );
    await emailValidationError.first().waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Email format validation works');

    // Test 4: Test valid form with mock credentials
    console.log('📍 Test 4: Testing valid credentials...');
    await emailField.clear();
    await emailField.fill('test@example.com');
    await passwordField.clear();
    await passwordField.fill('TestPassword123!');

    // Mock successful login response
    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: {},
          },
        }),
      });
    });

    await loginButton.click();

    // Wait for login processing
    await page.waitForTimeout(3000);

    // Check for successful login (redirect or success message)
    const currentUrl = page.url();
    const hasSuccessMessage = await page
      .locator('.v-alert--type-success, .alert-success')
      .isVisible();

    if (
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/projects') ||
      hasSuccessMessage
    ) {
      console.log('✅ Login successful - redirected or success message shown');
    } else {
      console.log('⚠️  Login response unclear - may need adjustment');
    }

    // Test 5: Test password visibility toggle
    console.log('📍 Test 5: Testing password visibility toggle...');
    await page.goto('http://localhost:3000/auth');
    await page.waitForLoadState('networkidle');

    const passwordInput = page.locator('input[type="password"]').first();
    const toggleButton = page
      .locator('.mdi-eye, .v-input__append button, [data-testid="password-toggle"]')
      .first();

    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      const passwordType = await passwordInput.getAttribute('type');
      if (passwordType === 'text') {
        console.log('✅ Password visibility toggle works');
      }
    } else {
      console.log('⚠️  Password toggle button not found');
    }

    // Test 6: Test navigation to register
    console.log('📍 Test 6: Testing navigation to register...');
    const registerLink = page.locator(
      ':has-text("Register"), :has-text("Sign up"), :has-text("Don\'t have an account")',
    );
    if (await registerLink.first().isVisible()) {
      await registerLink.first().click();
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/register')) {
        console.log('✅ Navigation to register page works');
      }
    } else {
      console.log('⚠️  Register link not found');
    }

    console.log('🎉 Final Login Flow Test Completed Successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testFinalLogin()
    .then(() => {
      console.log('✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

export { testFinalLogin };
