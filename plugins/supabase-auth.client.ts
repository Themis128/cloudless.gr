export default defineNuxtPlugin(async nuxtApp => {
  const router = useRouter();
  // Enhanced auth state change handler with better error handling
  nuxtApp.hooks.hook('app:mounted', () => {
    const client = useSupabaseClient();
    client.auth.onAuthStateChange(async (event, session) => {
      console.log('🔍 SUPABASE AUTH EVENT:', event, session?.user?.email || 'No user');

      try {
        // Handle successful sign in events
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ User signed in:', session.user.email);

          // Check if we're on the callback page and redirect appropriately
          const currentRoute = router.currentRoute.value;
          if (currentRoute.path === '/auth/callback') {
            console.log('🔄 Redirecting from callback page to dashboard');
            await router.push('/dashboard');
          }
        }

        // Handle sign out events
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');

          // Only redirect to login if we're on a protected page
          const currentRoute = router.currentRoute.value;
          const protectedRoutes = ['/dashboard', '/admin', '/settings', '/profile'];
          const isOnProtectedRoute = protectedRoutes.some(route =>
            currentRoute.path.startsWith(route)
          );

          if (isOnProtectedRoute) {
            console.log('🔄 Redirecting to login from protected route');
            await router.push('/auth/login');
          }
        }

        // Handle token refresh events
        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed for user:', session?.user?.email);
        }

        // Handle auth errors
        if (event === 'SIGNED_OUT' && !session) {
          console.log('⚠️ Auth session lost, may need to re-authenticate');
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
      }
    });
  });
  // On initial load, handle any pending auth state with timeout
  if (process.client) {
    try {
      // Check for auth fragments in URL (like #access_token=...)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('🔍 Found auth tokens in URL hash, processing...');

        // Give Supabase a moment to process the tokens with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth processing timeout')), 10000)
        );

        const authPromise = new Promise(resolve => setTimeout(resolve, 500));

        await Promise.race([authPromise, timeoutPromise]);

        // Check if we now have a session
        const client = useSupabaseClient();
        const {
          data: { session },
          error,
        } = await client.auth.getSession();
        if (session && !error) {
          console.log('✅ Session established from URL hash');

          // Clean up the URL hash
          if (window.history?.replaceState) {
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search
            );
          }
        } else if (error) {
          console.error('❌ Error processing auth hash:', error);
        }
      }
    } catch (error) {
      console.error('Error in initial auth processing:', error);
    }
  }
});
