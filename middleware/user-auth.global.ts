export default defineNuxtRouteMiddleware(async (to) => {
  // Routes that require user authentication
  const protectedRoutes = ['/profile', '/dashboard', '/settings'];

  // Check if the route requires authentication
  const requiresAuth = protectedRoutes.some((route) => to.path.startsWith(route));

  if (!requiresAuth) {
    return;
  }

  // Check authentication status via API call instead of composable
  if (process.client) {
    try {
      const { data } = await useFetch<{ authenticated: boolean }>('/api/auth/verify');

      if (!data.value?.authenticated) {
        return navigateTo('/auth/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      return navigateTo('/auth/login');
    }
  }
});
