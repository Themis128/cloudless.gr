import { useSupabase } from '@/composables/useSupabase'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/admin/login') return

  const supabase = useSupabase()
  const { data } = await supabase.auth.getSession()
  const email = data.session?.user?.email

  if (!email || !email.includes('admin')) {
    return navigateTo('/admin/login')
  }
})
