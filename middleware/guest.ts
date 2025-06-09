/**
 * Guest Middleware
 *
 * Restricts access to guest-only routes (like login/register)
 * Redirects authenticated users to dashboard
 */

export default defineNuxtRouteMiddleware(to => {
  // Skip middleware on server-side for performance
  if (process.server) return;

  const { user } = useSupabaseAuth();

  if (user.value) {
    const redirectTarget = to.query.redirectTo?.toString() || '/dashboard';
    return navigateTo(redirectTarget);
  }
});
