import { useSupabaseAuth } from "@/composables/useSupabaseAuth";

export default defineNuxtRouteMiddleware(async (to, _from) => {
  const { getUser } = useSupabaseAuth();
  
  try {
    const user = await getUser();
    
    // If the user is not logged in and trying to access a protected route
    if (!user && to.path.startsWith('/users')) {
      return navigateTo(`/auth?redirect=${encodeURIComponent(to.fullPath)}`);
    }

    // If user is logged in and trying to access the login page, redirect to dashboard
    if (user && (to.path === '/auth/login' || to.path === '/auth')) {
      return navigateTo('/users/index');
    }
  } catch (error) {
    console.error('[AUTH] Middleware error:', error);
    // On error, redirect to auth page for protected routes
    if (to.path.startsWith('/users')) {
      return navigateTo(`/auth?redirect=${encodeURIComponent(to.fullPath)}`);
    }
  }
});
