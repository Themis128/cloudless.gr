export const useSupabaseAuth = () => {
  const { $supabase } = useNuxtApp()

  const signIn = async (email: string, password: string) => {
    const { data, error } = await $supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await $supabase.auth.signOut()
  }

  const getUser = async () => {
    const { data } = await $supabase.auth.getUser()
    return data.user
  }

  return {
    signIn,
    signOut,
    getUser,
  }
}
