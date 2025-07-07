import { test, expect } from '@playwright/test';

test.describe('User Registration and Login', () => {
  test('register a test user and then login', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));

    console.log('1. Going to auth page to register...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Check if there's a register/signup option
    console.log('2. Looking for register/signup option...');
    
    // Try to find register button or link
    const registerButton = page.locator('text=Register').or(page.locator('text=Sign Up')).or(page.locator('text=Create Account')).first();
    if (await registerButton.isVisible({ timeout: 2000 })) {
      console.log('3. Found register button, clicking...');
      await registerButton.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('3. No register button found, checking if form allows registration...');
    }
    
    // If we're on a registration form, fill it out
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      console.log('4. Filling registration/login form...');
      await emailInput.fill('test@cloudless.gr');
      await passwordInput.fill('cloudless123');
      
      // Look for confirm password field (indicates registration)
      const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
      if (await confirmPasswordInput.isVisible({ timeout: 1000 })) {
        console.log('5. Found confirm password, filling...');
        await confirmPasswordInput.fill('cloudless123');
      }
      
      // Submit form
      console.log('6. Submitting form...');
      await page.click('button[type="submit"]');
      
      // Wait and see what happens
      await page.waitForTimeout(3000);
      console.log('7. After form submission, URL:', page.url());
      
      // Check for any messages
      const alerts = await page.locator('.v-alert, .error, .v-snackbar, .success').allTextContents();
      if (alerts.length > 0) {
        console.log('8. Messages on page:', alerts);
      }
    } else {
      console.log('4. Could not find form inputs');
    }
  });

  test('test with a potentially existing user', async ({ page }) => {
    // Try with admin credentials that might exist
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));

    console.log('1. Testing with admin credentials...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'admin@cloudless.gr');
    await page.fill('input[type="password"]', 'admin123');
    
    console.log('2. Clicking login...');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    console.log('3. After admin login attempt, URL:', page.url());
    
    // Check for messages
    const alerts = await page.locator('.v-alert, .error, .v-snackbar').allTextContents();
    console.log('4. Messages:', alerts);
  });

  test('check Supabase connection', async ({ page }) => {
    // Test the Supabase configuration
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));
    
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    // Run some JavaScript to check Supabase config
    const supabaseInfo = await page.evaluate(() => {
      return {
        url: (window as any).$config?.public?.supabaseUrl || 'not found',
        anonKeyLength: ((window as any).$config?.public?.supabaseAnonKey || '').length,
        hasSupabase: typeof (window as any).$supabase !== 'undefined'
      };
    });
    
    console.log('Supabase configuration:', supabaseInfo);
  });
});
