/**
 * Simple page authentication for SPA mode
 * Call this in any protected page's setup function
 */

export const useAuthRequired = async () => {
  // Only run on client side
  if (import.meta.server) return
  
  const supabase = useSupabaseClient()
  const route = useRoute()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session?.user) {
      // Not authenticated - redirect to login
      const redirectUrl = `/auth?redirect=${encodeURIComponent(route.fullPath)}`
      await navigateTo(redirectUrl)
      return
    }
    
    // User is authenticated
    return session.user
    
  } catch (err) {
    console.error('[AUTH] Authentication check failed:', err)
    await navigateTo('/auth')
  }
}

export const useAdminRequired = async () => {
  // Only run on client side
  if (import.meta.server) return
  
  const supabase = useSupabaseClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session?.user) {
      await navigateTo('/auth')
      return
    }
    
    // Check admin role
    type Profile = { role: string }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Profile>()
        if (profileError || !profile || profile.role !== 'admin') {
      await navigateTo('/auth?error=unauthorized')
      return
    }
    
    return session.user
      } catch (err) {
    console.error('[AUTH] Admin check failed:', err)
    await navigateTo('/auth')
  }
}
