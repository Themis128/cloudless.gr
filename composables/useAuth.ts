import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const supabase = useSupabase()
  const user = ref<User | null>(null)

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) user.value = data.user
    return { user: data.user, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
  }

  return {
    user,
    signIn,
    signOut
  }
}
