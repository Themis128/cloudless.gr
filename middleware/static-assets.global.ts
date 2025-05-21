// This middleware redirects routes to static assets to their correct locations
// For example, /gallery/noise.png would redirect to /public/gallery/noise.png

export default defineNuxtRouteMiddleware((to) => {
  // Check if the route is trying to access a file in the gallery that should be a static asset
  if (
    to.path.startsWith('/gallery/') &&
    (to.path.endsWith('.png') ||
      to.path.endsWith('.jpg') ||
      to.path.endsWith('.jpeg') ||
      to.path.endsWith('.svg') ||
      to.path.endsWith('.gif'))
  ) {
    // Extract the filename
    const filename = to.path.split('/').pop();

    // In Nuxt, files in the public directory are served at the root path
    // No need to redirect, as we have the file in public/gallery
    return;
  }
});
