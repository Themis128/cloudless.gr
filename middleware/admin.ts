import { useSupabase } from '@/composables/useSupabase'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/auth/admin-login') return

  const supabase = useSupabase()

  // Check session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const email = sessionData.session?.user?.email

  if (sessionError || !email) {
    console.warn('No valid session or email found', sessionError)
    return navigateTo('/auth/admin-login')
  }

  // Check if email exists in admins table
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('email')
    .eq('email', email)
    .single()

  if (adminError || !adminData) {
    console.warn('Admin not found or DB error', adminError)
    return navigateTo('/auth/admin-login')
  }
})
