// This middleware protects admin routes
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip if not in client context or not an admin route
  if (!process.client || !to.path.startsWith('/admin')) {
    return;
  }

  // If we're on the login page, no need to check further
  if (to.path === '/admin/login') {
    return;
  }
  
  // Use our auth composable to check user's authentication and role
  const { currentUser, isLoggedIn, checkAuthStatus, authInitialized } = useUserAuth();
  
  // If auth isn't initialized yet, force a check
  if (!authInitialized.value) {
    await checkAuthStatus();
  }
  
  // Verify authentication and admin role
  const isAuthenticated = isLoggedIn.value;
  const isAdmin = currentUser.value?.role === 'admin';
  
  // If not authenticated or not an admin, redirect to login
  if (!isAuthenticated || !isAdmin) {
    return navigateTo({
      path: '/admin/login', 
      query: { redirect: to.fullPath }
    });
  }
});
