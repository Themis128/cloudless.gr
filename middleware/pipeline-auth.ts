export default defineNuxtRouteMiddleware((to: any) => {
  // Add your pipeline authentication logic here
  const isAuthenticated = false // Replace with actual auth check

  if (!isAuthenticated && to.path.startsWith('/pipelines/')) {
    return navigateTo('/auth/login')
  }
})
