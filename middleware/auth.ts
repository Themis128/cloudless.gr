export default defineNuxtRouteMiddleware(async (to, from) => {
  const { getUser } = useSupabaseAuth()
  const user = await getUser()

  // If the user is not logged in and trying to access a protected route
  if (!user && to.path.startsWith('/users')) {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // If user is logged in and trying to access the login page, redirect to dashboard
  if (user && to.path === '/auth/login') {
    return navigateTo('/users/index')
  }
})
