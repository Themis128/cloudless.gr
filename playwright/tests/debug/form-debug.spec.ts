import { test, expect } from '@playwright/test';

test.describe('Form Interaction Debug', () => {
  test('debug form submission and handlers', async ({ page }) => {
    const logs: string[] = [];
    
    // Capture all console logs and errors
    page.on('console', msg => {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      logs.push(`[PAGE ERROR] ${error.message}`);
    });
    
    // Clear auth state
    await page.context().clearCookies();
    
    // Go to auth page
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    console.log('1. Page loaded, checking form elements...');
    
    // Check if form elements exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button:has-text("Sign In")');
    
    console.log('2. Email input exists:', await emailInput.count() > 0);
    console.log('3. Password input exists:', await passwordInput.count() > 0);
    console.log('4. Submit button exists:', await submitButton.count() > 0);
    
    // Check button state
    const isDisabled = await submitButton.getAttribute('disabled');
    console.log('5. Button disabled:', isDisabled !== null);
    
    // Fill form
    await emailInput.fill('baltzakis.themis@gmail.com');
    await passwordInput.fill('TH!123789th!');
    
    console.log('6. Form filled, checking button state again...');
    const isDisabledAfterFill = await submitButton.getAttribute('disabled');
    console.log('7. Button disabled after fill:', isDisabledAfterFill !== null);
    
    // Wait a moment for validation
    await page.waitForTimeout(1000);
    const isDisabledAfterWait = await submitButton.getAttribute('disabled');
    console.log('8. Button disabled after wait:', isDisabledAfterWait !== null);
    
    // Try clicking - but add JavaScript to track if handlers are called
    await page.evaluate(() => {
      console.log('[DEBUG] Adding event listener tracking...');
      
      // Find the form and button
      const form = document.querySelector('form');
      const button = document.querySelector('button[type="submit"]');
      
      if (form) {
        form.addEventListener('submit', (e) => {
          console.log('[DEBUG] Form submit event triggered', e);
        });
      }
      
      if (button) {
        button.addEventListener('click', (e) => {
          console.log('[DEBUG] Button click event triggered', e);
        });
      }
    });
    
    console.log('9. About to click submit button...');
    
    // Use Promise.race to detect if click hangs
    const clickResult = await Promise.race([
      (async () => {
        await submitButton.click();
        return 'click_completed';
      })(),
      (async () => {
        await page.waitForTimeout(5000);
        return 'timeout';
      })()
    ]);
    
    console.log('10. Click result:', clickResult);
    
    // Wait a bit more and check logs
    await page.waitForTimeout(2000);
    
    console.log('\n=== BROWSER CONSOLE LOGS ===');
    logs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');
    
    console.log('11. Final URL:', page.url());
  });
});
