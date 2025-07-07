import { test } from '@playwright/test';

test.describe('Navigation Debug', () => {
  test('debug navigation to /users after auth', async ({ page }) => {
    // Enable verbose console logging
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));

    // First, login successfully
    console.log('1. Logging in...');
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'baltzakis.themis@gmail.com');
    await page.fill('input[type="password"]', 'TH!123789th!');
    await page.click('button:has-text("Sign In")');
    
    // Wait for login to complete
    await page.waitForTimeout(3000);
    console.log('2. After login attempt, URL:', page.url());
    
    // Check if user is authenticated by checking cookies/localStorage
    const authState = await page.evaluate(() => {
      return {
        cookies: document.cookie,
        localStorage: Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('auth')
        ).reduce((obj, key) => {
          obj[key] = localStorage.getItem(key);
          return obj;
        }, {} as Record<string, string | null>),
        sessionStorage: Object.keys(sessionStorage).filter(key => 
          key.includes('supabase') || key.includes('auth')
        ).reduce((obj, key) => {
          obj[key] = sessionStorage.getItem(key);
          return obj;
        }, {} as Record<string, string | null>)
      };
    });
    
    console.log('3. Auth state after login:');
    console.log('- Cookies:', authState.cookies);
    console.log('- LocalStorage keys:', Object.keys(authState.localStorage));
    console.log('- SessionStorage keys:', Object.keys(authState.sessionStorage));
    
    // Now try to navigate to /users with a shorter timeout
    console.log('4. Attempting navigation to /users with 10s timeout...');
    try {
      await page.goto('/users', { timeout: 10000 });
      console.log('5. Successfully navigated to /users:', page.url());
    } catch (error) {
      console.log('5. Navigation to /users failed:', error.message);
      console.log('6. Current URL after failed navigation:', page.url());
      
      // Try to see what's actually happening on the page
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          readyState: document.readyState,
          hasH1: !!document.querySelector('h1'),
          hasForm: !!document.querySelector('form'),
          bodyText: document.body?.textContent?.substring(0, 200) || 'no body'
        };
      });
      console.log('7. Page state during navigation:', pageContent);
    }
  });

  test('debug direct access to /users', async ({ page }) => {
    // Test accessing /users directly without login
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));

    console.log('1. Accessing /users directly...');
    try {
      await page.goto('/users', { timeout: 10000 });
      console.log('2. Direct access to /users successful:', page.url());
    } catch (error) {
      console.log('2. Direct access to /users failed:', error.message);
      console.log('3. Current URL after failed navigation:', page.url());
    }
  });

  test('check what pages are accessible', async ({ page }) => {
    // Test multiple pages to see which ones work
    page.on('console', msg => console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`));

    const pagesToTest = ['/', '/info', '/auth', '/users', '/admin'];
    
    for (const pageUrl of pagesToTest) {
      console.log(`Testing ${pageUrl}...`);
      try {
        await page.goto(pageUrl, { timeout: 5000 });
        console.log(`✅ ${pageUrl} - Success: ${page.url()}`);
        await page.waitForTimeout(1000); // Brief pause between tests
      } catch (error) {
        console.log(`❌ ${pageUrl} - Failed: ${error.message}`);
      }
    }
  });
});
