import { test, expect } from '@playwright/test';

test.describe('Direct Manual Auth Test', () => {
  test('bypass form and test manual auth + navigation directly', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth/');
    await page.waitForLoadState('networkidle');
    
    // Wait for manual client to be initialized
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' && (window as any).$manualSupabase;
    }, { timeout: 10000 });
    
    console.log('1. Manual Supabase client is available');
    
    // Test direct authentication using the manual client
    const authResult = await page.evaluate(async () => {
      try {
        const client = (window as any).$manualSupabase;
        console.log('[DIRECT AUTH] Manual client available:', !!client);
        
        const { data, error } = await client.auth.signInWithPassword({
          email: 'baltzakis.themis@gmail.com',
          password: 'P@ssw0rd123!'
        });
        
        console.log('[DIRECT AUTH] Auth result:', { 
          success: !error, 
          userId: data?.user?.id, 
          email: data?.user?.email,
          error: error?.message 
        });
        
        return {
          success: !error,
          user: data?.user ? { id: data.user.id, email: data.user.email } : null,
          error: error?.message
        };
      } catch (e) {
        console.error('[DIRECT AUTH] Exception:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
    
    console.log('2. Direct auth result:', authResult);
    expect(authResult.success).toBe(true);
    expect(authResult.user).toBeTruthy();
    
    // Now test navigation using the handleLoginSuccess function
    const navigationResult = await page.evaluate(async () => {
      try {
        // Call the success handler that should trigger navigation
        const successHandler = (window as any).testSuccessHandler;
        if (typeof successHandler === 'function') {
          console.log('[NAVIGATION] Calling success handler...');
          await successHandler();
          
          // Wait a bit for navigation to happen
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          return {
            success: true,
            currentUrl: (window as any).location.href
          };
        } else {
          return { success: false, error: 'Success handler not found' };
        }
      } catch (e) {
        console.error('[NAVIGATION] Exception:', e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      }
    });
    
    console.log('3. Navigation result:', navigationResult);
    
    // Check final URL
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log('4. Final URL:', finalUrl);
    
    // Should be on /users or successful redirect
    expect(finalUrl).toMatch(/\/(users|dashboard)/);
    
    console.log('✅ Direct manual auth and navigation test completed successfully');
  });
});
