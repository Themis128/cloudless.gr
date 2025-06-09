export default defineNuxtRouteMiddleware((to) => {
  // Only apply to admin routes
  if (!to.path.startsWith('/admin')) {
    return;
  }

  // Skip auth check for admin login page
  if (to.path === '/admin/login' || to.path === '/auth/admin-login') {
    return;
  }

  // Check if user is authenticated and has admin role
  const { currentUser, isLoggedIn } = useUserAuth();

  if (!isLoggedIn.value) {
    // Redirect to admin login if not authenticated
    return navigateTo('/auth/admin-login');
  }

  if (!currentUser.value || currentUser.value.role !== 'admin') {
    // Redirect to login if not admin
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied. Admin privileges required.',
    });
  }
});
