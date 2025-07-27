// User authentication middleware
export default defineNuxtRouteMiddleware((to: any) => {
  // Add your user authentication logic here
  const isAuthenticated = false // Replace with actual auth check

  if (!isAuthenticated && to.path.startsWith('/user/')) {
    return navigateTo('/auth/login')
  }
})
