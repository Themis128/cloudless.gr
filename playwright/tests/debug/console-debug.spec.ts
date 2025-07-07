import { test, expect } from '@playwright/test';

test.describe('Console Debug Test', () => {
  test('capture console logs during login attempt', async ({ page }) => {
    const logs: string[] = [];
    
    // Capture all console logs
    page.on('console', msg => {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    // Clear auth state
    await page.context().clearCookies();
    
    // Go to auth page
    await page.goto('/auth');
    console.log('1. Navigated to auth page');
    
    // Fill form
    await page.fill('input[type="email"]', 'baltzakis.themis@gmail.com');
    await page.fill('input[type="password"]', 'TH!123789th!');
    console.log('2. Form filled');
    
    // Click login and immediately check what happens
    console.log('3. About to click login button...');
    const clickPromise = page.click('button:has-text("Sign In")');
    
    // Wait a short time to see if any errors or logs appear
    await page.waitForTimeout(3000);
    console.log('4. Waited 3 seconds after click attempt');
    
    // Check if click is still pending
    try {
      await Promise.race([
        clickPromise,
        page.waitForTimeout(2000)
      ]);
      console.log('5. Click completed or timeout reached');
    } catch (err) {
      console.log('5. Click failed:', err.message);
    }
    
    // Print all console logs
    console.log('\n=== BROWSER CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');
    
    console.log('6. Final URL:', page.url());
  });
});
