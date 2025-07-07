import { test, expect } from '@playwright/test';

test.describe('Full Auth Flow Debug', () => {
  test('capture all logs during complete auth flow', async ({ page }) => {
    const logs: string[] = [];
    const errors: string[] = [];
    
    // Capture everything
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[CONSOLE-${msg.type().toUpperCase()}] ${text}`);
    });
    
    page.on('pageerror', error => {
      errors.push(`[PAGE-ERROR] ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      errors.push(`[REQUEST-FAILED] ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    // Clear auth state
    await page.context().clearCookies();
    
    // Go to auth page and wait for full load
    console.log('1. Navigating to auth page...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Fill form
    console.log('2. Filling form...');
    await page.fill('input[type="email"]', 'baltzakis.themis@gmail.com');
    await page.fill('input[type="password"]', 'TH!123789th!');
    
    // Click and watch what happens
    console.log('3. Clicking Sign In button...');
    const submitButton = page.locator('button:has-text("Sign In")');
    
    // Start monitoring for any responses or navigation
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('auth') || response.url().includes('api'), 
      { timeout: 10000 }
    ).catch(() => null);
    
    const navigationPromise = page.waitForURL(url => 
      !url.toString().includes('/auth'), 
      { timeout: 10000 }
    ).catch(() => null);
    
    await submitButton.click();
    
    // Wait for either a response or navigation
    console.log('4. Waiting for response or navigation...');
    const result = await Promise.race([
      responsePromise,
      navigationPromise,
      page.waitForTimeout(8000).then(() => 'timeout')
    ]);
    
    if (result === 'timeout') {
      console.log('5. Timed out waiting for response/navigation');
    } else if (result && typeof result === 'object' && 'url' in result) {
      console.log('5. Got response:', result.url(), result.status());
    } else {
      console.log('5. Navigation occurred');
    }
    
    // Wait a bit more and capture final state
    await page.waitForTimeout(2000);
    
    console.log('6. Final URL:', page.url());
    
    // Print all captured logs
    console.log('\n=== ALL CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
    
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(error => console.log(error));
    }
    
    console.log('=== END LOGS ===\n');
  });
});
