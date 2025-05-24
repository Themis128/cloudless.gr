// This middleware protects routes that require user authentication
export default defineNuxtRouteMiddleware((to) => {
  // Skip middleware if in server side rendering context
  if (!process.client) return;

  // Get auth state from useUserAuth
  const { isLoggedIn } = useUserAuth();

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];

  // Check if the current route is a public one
  const isPublicRoute = publicRoutes.some(route => 
    to.path === route || to.path.startsWith('/auth/')
  );
  
  // Special handling for home page - decide if you want it public or protected
  const isHomePage = to.path === '/';

  // If route is not public and user is not logged in, redirect to login
  if (!isPublicRoute && !isHomePage && !isLoggedIn.value) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath }
    });
  }
  
  // If user is already logged in and tries to access auth pages, redirect to dashboard
  if (isPublicRoute && isLoggedIn.value) {
    return navigateTo('/dashboard');
  }
});
