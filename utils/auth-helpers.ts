/**
 * Authentication helper utilities for Supabase integration
 */

export async function handleAuthRedirect() {
  try {
    const supabase = useSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Auth redirect error:', error)
      return false
    }

    // Check if we have a valid session
    if (data.session) {
      return true
    }

    return false
  } catch (err) {
    console.error('Auth helper error:', err)
    return false
  }
}

export function getAuthRedirectUrl(provider: string = 'magic_link') {
  const baseUrl = window.location.origin
  return `${baseUrl}/auth/callback?provider=${provider}`
}

export async function signOut() {
  try {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Sign out error:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('Sign out helper error:', err)
    return false
  }
}
