import { test } from '@playwright/test';

test('debug runtime config access', async ({ page }) => {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  
  // Check how to access runtime config in Nuxt 3
  const configDebug = await page.evaluate(() => {
    // Try different ways to access config
    const methods = {
      // Method 1: Direct window access
      windowConfig: (window as any).$config,
      
      // Method 2: Nuxt app access
      nuxtApp: (window as any).$nuxt,
      
      // Method 3: Check for useRuntimeConfig
      useRuntimeConfig: typeof (window as any).useRuntimeConfig,
      
      // Method 4: Environment variables
      processEnv: (window as any).process?.env,
      
      // Method 5: Check what's actually in the window
      windowKeys: Object.keys(window).filter(key => 
        key.includes('config') || 
        key.includes('supabase') || 
        key.includes('runtime') ||
        key.includes('nuxt')
      ),
      
      // Method 6: Try to call useRuntimeConfig if it exists
      runtimeConfigResult: (() => {
        try {
          if (typeof (window as any).useRuntimeConfig === 'function') {
            return (window as any).useRuntimeConfig();
          }
          return 'function not available';
        } catch (e) {
          return `error: ${e instanceof Error ? e.message : String(e)}`;
        }
      })()
    };
    
    return methods;
  });
  
  console.log('=== RUNTIME CONFIG DEBUG ===');
  console.log(JSON.stringify(configDebug, null, 2));
  
  // Try to inject the correct configuration manually as a test
  await page.evaluate(() => {
    // Manually set the config to test if this fixes the issue
    const config = {
      public: {
        supabaseUrl: 'http://localhost:54321',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      }
    };
    
    // Set it in multiple places
    (window as any).$config = config;
    if ((window as any).$nuxt) {
      (window as any).$nuxt.config = config;
    }
    
    console.log('Manually injected config:', config);
  });
  
  // Check if the manual injection worked
  const afterInjection = await page.evaluate(() => {
    return {
      windowConfig: (window as any).$config,
      configExists: !!(window as any).$config
    };
  });
  
  console.log('=== AFTER MANUAL INJECTION ===');
  console.log(JSON.stringify(afterInjection, null, 2));
});
