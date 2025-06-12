export default defineNuxtRouteMiddleware(async (to) => {
  // Allow access to auth pages without redirect
  if (["/auth/login", "/auth/register", "/auth/reset"].includes(to.path)) return

  const { $supabase } = useNuxtApp()
  const session = await $supabase.auth.getSession()
  if (!session.data.session) {
    return navigateTo('/auth/login')
  }
})
