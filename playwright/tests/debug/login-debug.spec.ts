import { test, expect } from '@playwright/test';

test.describe('Login Debug Tests', () => {
  const testUser = {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!'
  };

  test('debug login flow - see where we actually end up', async ({ page }) => {
    // Clear auth state
    await page.context().clearCookies();
    
    // Go to auth page
    await page.goto('/auth');
    
    console.log('1. Auth page loaded:', page.url());
    
    // Fill and submit form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    console.log('2. Form filled, about to click Sign In');
    
    await page.click('button:has-text("Sign In")');
    
    // Wait a bit and see where we end up
    await page.waitForTimeout(5000);
    
    console.log('3. After login attempt, current URL:', page.url());
    
    // Wait for any redirects to complete
    await page.waitForLoadState('networkidle');
    
    console.log('4. After networkidle, final URL:', page.url());
    
    // Check what's on the page
    const title = await page.locator('h1, h2, h3').first().textContent();
    console.log('5. Page title/heading:', title);
    
    // Just ensure we're not on the auth page anymore (successful login)
    expect(page.url()).not.toContain('/auth');
  });

  test('debug redirect parameter - see what actually happens', async ({ page }) => {
    // Clear auth state
    await page.context().clearCookies();
    
    // Go to auth page with redirect
    await page.goto('/auth?redirect=/admin');
    
    console.log('1. Auth page with redirect loaded:', page.url());
    
    // Fill and submit form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    
    console.log('2. Form filled, about to click Sign In');
    
    await page.click('button:has-text("Sign In")');
    
    // Wait a bit and see where we end up
    await page.waitForTimeout(5000);
    
    console.log('3. After login attempt, current URL:', page.url());
    
    // Wait for any redirects to complete
    await page.waitForLoadState('networkidle');
    
    console.log('4. After networkidle, final URL:', page.url());
    
    // Check what's on the page
    const title = await page.locator('h1, h2, h3').first().textContent();
    console.log('5. Page title/heading:', title);
    
    // Just ensure we're logged in
    expect(page.url()).not.toContain('/auth');
  });

  test('debug what happens when accessing protected route directly', async ({ page }) => {
    // Clear auth state
    await page.context().clearCookies();
    
    // Try to access /admin directly
    console.log('1. Accessing /admin directly...');
    await page.goto('/admin');
    
    await page.waitForTimeout(2000);
    console.log('2. After accessing /admin, current URL:', page.url());
    
    await page.waitForLoadState('networkidle');
    console.log('3. After networkidle, final URL:', page.url());
    
    // Should be redirected to auth
    expect(page.url()).toContain('/auth');
    
    // Now login
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(5000);
    console.log('4. After login, current URL:', page.url());
    
    await page.waitForLoadState('networkidle');
    console.log('5. After networkidle, final URL:', page.url());
    
    // Should be somewhere we can access
    expect(page.url()).not.toContain('/auth');
  });
});
