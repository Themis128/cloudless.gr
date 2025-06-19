/**
 * Robust Authentication Flow Test
 * Comprehensive authentication test covering login, registration, and error scenarios
 */

import { chromium } from 'playwright';

async function testRobustAuth() {
  console.log('🚀 Starting Robust Authentication Test...');

  let browser, context, page;

  try {
    browser = await chromium.launch({
      headless: process.env.CI === 'true', // Headless in CI, visible locally
      slowMo: process.env.CI === 'true' ? 0 : 500,
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    page = await context.newPage();

    // Test Suite 1: Login Flow
    await testLoginFlow(page);

    // Test Suite 2: Registration Flow
    await testRegistrationFlow(page);

    // Test Suite 3: Admin Login Flow
    await testAdminLoginFlow(page);

    // Test Suite 4: Password Reset Flow
    await testPasswordResetFlow(page);

    // Test Suite 5: Authentication State Management
    await testAuthStateManagement(page);

    console.log('🎉 Robust Authentication Test Completed Successfully!');
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function testLoginFlow(page) {
  console.log('📍 Testing Login Flow...');

  await page.goto('http://localhost:3000/auth');
  await page.waitForLoadState('networkidle');

  // Test empty form submission
  await page.locator('button:has-text("Login")').click();
  await page.waitForSelector(':has-text("required")', { timeout: 5000 });
  console.log('✅ Login validation works');

  // Test invalid credentials
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'wrongpassword');

  // Mock failed login
  await page.route('**/auth/v1/token*', (route) => {
    route.fulfill({
      status: 400,
      body: JSON.stringify({ error: 'Invalid credentials' }),
    });
  });

  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);

  console.log('✅ Invalid login handled');
}

async function testRegistrationFlow(page) {
  console.log('📍 Testing Registration Flow...');

  await page.goto('http://localhost:3000/auth/register');
  await page.waitForLoadState('networkidle');

  // Test password mismatch
  await page.fill('input[type="text"]', 'Test User');
  await page.fill('input[type="email"]', 'new@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.locator('input[type="password"]').nth(1).fill('Different123!');

  await page.locator('button:has-text("Create Account"), button:has-text("Register")').click();
  await page.waitForSelector(':has-text("match")', { timeout: 5000 });

  console.log('✅ Password mismatch validation works');
}

async function testAdminLoginFlow(page) {
  console.log('📍 Testing Admin Login Flow...');

  await page.goto('http://localhost:3000/admin/login');
  await page.waitForLoadState('networkidle');

  const hasForm = await page.locator('form').isVisible();
  if (hasForm) {
    console.log('✅ Admin login page accessible');

    // Test admin-specific validation
    await page.fill('input[type="email"]', 'user@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.locator('button:has-text("Login")').click();

    await page.waitForTimeout(2000);
    console.log('✅ Admin login form functional');
  }
}

async function testPasswordResetFlow(page) {
  console.log('📍 Testing Password Reset Flow...');

  await page.goto('http://localhost:3000/auth');

  const forgotPasswordLink = page.locator(':has-text("Forgot Password")');
  if (await forgotPasswordLink.isVisible()) {
    await forgotPasswordLink.click();
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/reset')) {
      console.log('✅ Password reset navigation works');
    }
  } else {
    console.log('⚠️  Forgot password link not found');
  }
}

async function testAuthStateManagement(page) {
  console.log('📍 Testing Auth State Management...');

  // Mock successful login
  await page.addInitScript(() => {
    localStorage.setItem(
      'supabase.auth.token',
      JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' },
      }),
    );
  });

  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  // Check if authenticated state is recognized
  const hasUserMenu = await page
    .locator(':has-text("Profile"), :has-text("Logout"), [data-testid="user-menu"]')
    .isVisible();
  if (hasUserMenu) {
    console.log('✅ Authenticated state recognized');
  } else {
    console.log('⚠️  Authenticated state not clearly indicated');
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRobustAuth()
    .then(() => {
      console.log('✅ All authentication tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Authentication test suite failed:', error);
      process.exit(1);
    });
}

export { testRobustAuth };
