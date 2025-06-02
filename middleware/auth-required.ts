// middleware/auth-required.ts
export default defineNuxtRouteMiddleware((to) => {
  // This middleware ensures the user is authenticated before accessing protected routes

  const { isAuthenticated, user } = useAuth();
  // Check if user is authenticated
  if (!isAuthenticated.value) {
    // Store the intended destination and redirect to login
    const loginUrl = `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`;
    return navigateTo(loginUrl);
  }

  // If authenticated but no user data, this might indicate an auth issue
  if (!user.value) {
    console.warn('User authenticated but no user data available');
  }
});
