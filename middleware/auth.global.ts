import { useSupabase } from '~/composables/useSupabase'

// List of public routes (add more as needed)
const publicRoutes = ['/', '/about', '/contact', '/faq', '/auth/login', '/auth/register', '/auth/reset', '/auth/admin-login']

export default defineNuxtRouteMiddleware(async (to) => {
  if (publicRoutes.includes(to.path)) {
    return // Allow public access
  }
  const supabase = useSupabase()
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) {
    return navigateTo('/auth/login')
  }
})