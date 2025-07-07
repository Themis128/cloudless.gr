import { test } from '@playwright/test';

test('test Supabase auth directly', async ({ page }) => {
  // Navigate to auth page to get the Supabase client loaded
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  
  // Test Supabase authentication directly in the browser
  const authResult = await page.evaluate(async () => {
    try {
      // Try different ways to get the Supabase client
      let supabase;
      
      // Method 1: Check for manual Supabase client
      supabase = (window as any).$manualSupabase;
      if (supabase) {
        console.log('Found manual Supabase client');
      } else {
        // Method 2: Direct window access
        supabase = (window as any).$supabase;
        if (supabase) {
          console.log('Found window.$supabase');
        }
      }
      if (!supabase) {
        // Method 3: Try accessing through Nuxt app
        const nuxtApp = (window as any).$nuxt;
        if (nuxtApp && nuxtApp.$supabase) {
          supabase = nuxtApp.$supabase;
          console.log('Found nuxtApp.$supabase');
        }
      }
      
      if (!supabase) {
        // Method 4: Try to access the useSupabaseClient function
        const useSupabaseClient = (window as any).useSupabaseClient;
        if (typeof useSupabaseClient === 'function') {
          supabase = useSupabaseClient();
          console.log('Used useSupabaseClient function');
        }
      }
      
      if (!supabase) {
        return { 
          error: 'Supabase client not found',
          availableKeys: Object.keys(window).filter(k => 
            k.includes('supabase') || k.includes('$') || k.includes('manual')
          )
        };
      }
      
      console.log('Found Supabase client, testing auth...');
      
      // Try to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'baltzakis.themis@gmail.com',
        password: 'TH!123789th!'
      });
      
      if (error) {
        return { error: error.message, details: error };
      }
      
      return { 
        success: true, 
        user: data.user ? { 
          id: data.user.id, 
          email: data.user.email 
        } : null 
      };
      
    } catch (err) {
      return { 
        error: 'Exception during auth', 
        details: err instanceof Error ? err.message : String(err) 
      };
    }
  });
  
  console.log('=== DIRECT SUPABASE AUTH TEST ===');
  console.log(JSON.stringify(authResult, null, 2));
  
  // If auth succeeded, test if we can access protected routes
  if (authResult.success) {
    console.log('Auth succeeded, testing navigation...');
    
    try {
      await page.goto('/users', { timeout: 10000 });
      console.log('Navigation to /users successful:', page.url());
    } catch (error) {
      console.log('Navigation to /users failed:', error instanceof Error ? error.message : String(error));
    }
  }
});
