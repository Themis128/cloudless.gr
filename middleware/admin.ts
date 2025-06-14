import { useSupabase } from '@/composables/useSupabase'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/auth/admin-login') return

  const supabase = useSupabase()
  const { data } = await supabase.auth.getSession()
  const email = data.session?.user?.email

  if (!email) {
    return navigateTo('/auth/admin-login')
  }

  // Check if user is in admins table
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('email')
    .eq('email', email)
    .single()
  if (adminError || !adminData) {
    return navigateTo('/auth/admin-login')
  }
})
