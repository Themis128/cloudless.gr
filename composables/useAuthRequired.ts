
// Nuxt 3 + Supabase SPA authentication composables
import { useRoute, navigateTo } from '#imports'
import { getSupabaseClient } from '~/composables/useSupabase'

export const useAuthRequired = async () => {
  // Only run on client side
  if (process.server) return

  const supabase = getSupabaseClient()
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
  if (process.server) return

  const supabase = getSupabaseClient()
  const route = useRoute()

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) {
      await navigateTo('/auth')
      return
    }
    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    const typedProfile = profile as { role?: string } | null
    if (profileError || !typedProfile || typedProfile.role !== 'admin') {
      await navigateTo(`/auth?error=unauthorized&redirect=${encodeURIComponent(route.fullPath)}`)
      return
    }
    return session.user
  } catch (err) {
    console.error('[AUTH] Admin check failed:', err)
    await navigateTo('/auth')
  }
}
