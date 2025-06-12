import { useSupabase } from '~/composables/useSupabase'

export default defineNuxtRouteMiddleware(async (to) => {
  // ...existing code...
  const supabase = useSupabase()
  const session = await supabase.auth.getSession()
  // ...existing code...
})