import { useSupabaseAuth } from '@/composables/useSupabaseAuth';

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for admin login page
  if (to.path === '/auth/admin-login') return;

  const { isAuthenticated, isUserAdmin } = useSupabaseAuth();

  try {
    // Check if user is authenticated
    const authenticated = isAuthenticated.value;
    if (!authenticated) {
      console.warn('[ADMIN] User not authenticated');
      return navigateTo('/auth/admin-login?error=login_required');
    }

    // Check if user has admin role
    const hasAdminRole = await isUserAdmin();
    if (!hasAdminRole) {
      console.warn('[ADMIN] User is not admin');
      return navigateTo('/auth/admin-login?error=unauthorized');
    }

    // Admin access granted
    console.log('[ADMIN] Admin access granted');
  } catch (error) {
    console.error('[ADMIN] Middleware error:', error);
    return navigateTo('/auth/admin-login?error=system_error');
  }
});
