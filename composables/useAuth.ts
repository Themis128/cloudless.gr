import type { User } from '@supabase/supabase-js'
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

export const useAuth = () => {
  const supabase = useSupabase()
  const user = ref<User | null>(null)

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) user.value = data.user
    return { user: data.user, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    user.value = null
  }

  return {
    user,
    signIn,
    signOut,
  }
}
