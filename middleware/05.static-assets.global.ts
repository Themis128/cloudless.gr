export default defineNuxtRouteMiddleware((to) => {
  // Skip middleware for static assets and API routes
  if (to.path.startsWith('/_nuxt/') || to.path.startsWith('/api/') || to.path.includes('.')) {
    return;
  }

  // Continue with normal processing for other routes
});
