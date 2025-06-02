import { navigateTo } from '#app'
import { useSupabaseClient } from '@supabase/auth-helpers-nuxt'

export function useLogout() {
  const supabase = useSupabaseClient()

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error.message)
      return false
    }
    return navigateTo('/auth/login')
  }

  return {
    logout
  }
}
