import { test, expect } from '@playwright/test';

test.describe('Detailed Login Debug', () => {
  test('trace complete login flow with console logs', async ({ page }) => {
    // Enable console logging to capture all debug messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(text);
    });

    // Go to auth page
    console.log('1. Navigating to auth page...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    console.log('2. Current URL after auth page load:', page.url());

    // Wait for the form to be ready
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Fill login form
    console.log('3. Filling login form...');
    await page.fill('input[type="email"]', 'baltzakis.themis@gmail.com');
    await page.fill('input[type="password"]', 'TH!123789th!');
    
    // Log current URL before login attempt
    console.log('4. URL before login:', page.url());
    
    // Click login and wait for navigation
    console.log('5. Clicking login button...');
    await page.click('button[type="submit"]');
    
    // Wait a bit and check URL changes
    await page.waitForTimeout(2000);
    console.log('6. URL after login click (2s):', page.url());
    
    await page.waitForTimeout(3000);
    console.log('7. URL after login click (5s total):', page.url());
    
    // Try to wait for network to be idle
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log('8. Network idle reached');
    } catch (e) {
      console.log('8. Network idle timeout:', e instanceof Error ? e.message : String(e));
    }
    
    console.log('9. Final URL:', page.url());
    
    // Check what's actually on the page
    try {
      const title = await page.locator('h1, h2, h3, .v-card-title').first().textContent({ timeout: 5000 });
      console.log('10. Page title/heading:', title);
    } catch (e) {
      console.log('10. No title found:', e instanceof Error ? e.message : String(e));
    }
    
    // Check for any error messages
    try {
      const alerts = await page.locator('.v-alert, .error, .v-snackbar').allTextContents();
      if (alerts.length > 0) {
        console.log('11. Alert messages found:', alerts);
      }
    } catch (e) {
      console.log('11. No alerts found');
    }
    
    // Log all captured console messages
    console.log('=== CAPTURED CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg}`);
    });
    
    // Just log the final state instead of asserting anything
    console.log('Test completed. Final state:');
    console.log('- URL:', page.url());
    console.log('- Total console messages:', consoleMessages.length);
    
    // Find auth-related messages
    const authMessages = consoleMessages.filter(msg => 
      msg.includes('[AUTH]') || 
      msg.includes('[Navigation]') || 
      msg.includes('redirect') ||
      msg.includes('login')
    );
    
    console.log('=== AUTH RELATED MESSAGES ===');
    authMessages.forEach(msg => console.log(msg));
  });

  test('test manual navigation after login', async ({ page }) => {
    // Go to auth page and login
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Fill and submit form
    await page.fill('input[type="email"]', 'baltzakis.themis@gmail.com');
    await page.fill('input[type="password"]', 'TH!123789th!');
    await page.click('button[type="submit"]');
    
    // Wait for any automatic redirects to finish
    await page.waitForTimeout(5000);
    
    console.log('After login URL:', page.url());
    
    // Try to manually navigate to /users
    console.log('Attempting manual navigation to /users...');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    
    console.log('After manual navigation to /users:', page.url());
    
    // Try to manually navigate to /admin  
    console.log('Attempting manual navigation to /admin...');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    console.log('After manual navigation to /admin:', page.url());
  });
});
