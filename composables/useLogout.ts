import { navigateTo } from '#imports'
import { useSupabaseClient } from '#supabase/composables/useSupabaseClient'

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
