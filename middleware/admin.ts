import { useSupabaseAuth } from '@/composables/useSupabaseAuth';

export default defineNuxtRouteMiddleware(async (_to) => {
  const { isAuthenticated, isUserAdmin } = useSupabaseAuth();

  try {
    // Check if user is authenticated
    const authenticated = isAuthenticated.value;
    if (!authenticated) {
      console.warn('[ADMIN] User not authenticated');
      return navigateTo('/auth?error=login_required');
    }

    // Check if user has admin role
    const hasAdminRole = await isUserAdmin();
    if (!hasAdminRole) {
      console.warn('[ADMIN] User is not admin');
      return navigateTo('/auth?error=unauthorized');
    }

    // Admin access granted
    console.log('[ADMIN] Admin access granted');
  } catch (error) {
    console.error('[ADMIN] Middleware error:', error);
    return navigateTo('/auth?error=system_error');
  }
});
