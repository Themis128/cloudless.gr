import { test } from '@playwright/test';

test('check runtime configuration', async ({ page }) => {
  // Navigate to any page
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  
  // Check runtime config
  const runtimeConfig = await page.evaluate(() => {
    // Check all possible ways Nuxt exposes config
    return {
      // @nuxtjs/supabase uses these internally
      SUPABASE_URL: (window as any).process?.env?.SUPABASE_URL || 'not found',
      SUPABASE_ANON_KEY: (window as any).process?.env?.SUPABASE_ANON_KEY || 'not found',
      
      // Check Nuxt runtime config
      nuxtConfig: (window as any).$config || 'not found',
      
      // Check if useRuntimeConfig is available
      runtimeConfigAvailable: typeof (window as any).useRuntimeConfig !== 'undefined',
      
      // Check what's actually in window
      windowKeys: Object.keys(window).filter(key => 
        key.includes('supabase') || 
        key.includes('config') || 
        key.includes('nuxt')
      ),
      
      // Check environment from Nuxt
      nodeEnv: (window as any).process?.env?.NODE_ENV || 'not found',
      
      // Check if supabase client exists
      supabaseExists: typeof (window as any).$supabase !== 'undefined',
      supabaseClientExists: typeof (window as any).$supabaseClient !== 'undefined'
    };
  });
  
  console.log('=== RUNTIME CONFIGURATION DEBUG ===');
  console.log(JSON.stringify(runtimeConfig, null, 2));
  
  // Also check what's in the Nuxt app
  const appInfo = await page.evaluate(() => {
    const app = (window as any).$nuxt || (window as any).__NUXT__ || {};
    return {
      nuxtExists: typeof app !== 'undefined',
      appKeys: typeof app === 'object' ? Object.keys(app) : 'not object',
      ssrContext: app.ssrContext || 'not found'
    };
  });
  
  console.log('=== NUXT APP INFO ===');
  console.log(JSON.stringify(appInfo, null, 2));
});
