export async function handleAuthRedirect() {
  const supabase = useSupabaseClient()
  const { error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Auth redirect error:', error)
    return false
  }

  return true
}

export function getAuthRedirectUrl(provider: string = 'magic_link') {
  const baseUrl = window.location.origin
  return `${baseUrl}/auth/callback?provider=${provider}`
}
