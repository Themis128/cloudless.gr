/**
 * Enhanced Authentication Composable
 * Supports Google OAuth, Magic Link, and advanced auth flows
 */

export const useAdvancedAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const router = useRouter()

  const authState = reactive({
    isLoading: false,
    socialLoading: null as string | null,
    error: null as string | null,
    success: null as string | null,
    redirectUrl: '/dashboard'
  })

  // Enhanced Google OAuth with profile data
  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    authState.socialLoading = 'google'
    authState.error = null

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback?provider=google`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          scopes: 'email profile openid'
        }
      })

      if (error) throw error

      // OAuth redirect will happen automatically
      return { success: true, error: null }
    } catch (err: any) {
      const errorMessage = err.message.includes('popup') 
        ? 'Popup was blocked. Please allow popups for this site.'
        : err.message
      
      authState.error = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      authState.socialLoading = null
    }
  }

  // Enhanced GitHub OAuth
  const signInWithGitHub = async (options?: { redirectTo?: string }) => {
    authState.socialLoading = 'github'
    authState.error = null

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: options?.redirectTo || `${window.location.origin}/auth/callback?provider=github`,
          scopes: 'read:user user:email'
        }
      })

      if (error) throw error
      return { success: true, error: null }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.socialLoading = null
    }
  }

  // Enhanced Magic Link with better UX
  const sendMagicLink = async (email: string, options?: { 
    redirectTo?: string
    shouldCreateUser?: boolean 
  }) => {
    authState.isLoading = true
    authState.error = null

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: options?.redirectTo || `${window.location.origin}/auth/callback?type=magiclink`,
          shouldCreateUser: options?.shouldCreateUser ?? true,
          data: {
            email,
            provider: 'magic_link',
            created_at: new Date().toISOString()
          }
        }
      })

      if (error) {
        if (error.message.includes('rate limit')) {
          throw new Error('Too many requests. Please wait a moment before requesting another magic link.')
        }
        throw error
      }

      authState.success = 'Magic link sent! Check your email and click the link to sign in.'
      return { success: true, error: null }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.isLoading = false
    }
  }

  // Enhanced password sign-in with better error handling
  const signInWithPassword = async (email: string, password: string) => {
    authState.isLoading = true
    authState.error = null

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // Enhanced error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. If you just signed up, please check your email and confirm your account first.')
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.')
        } else if (error.message.includes('rate limit')) {
          throw new Error('Too many login attempts. Please wait a moment before trying again.')
        }
        throw error
      }

      // Create/update user profile after successful login
      if (data.user) {
        await ensureUserProfile(data.user)
      }

      authState.success = 'Successfully signed in!'
      return { success: true, error: null, user: data.user }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.isLoading = false
    }
  }

  // Enhanced sign-up with profile creation
  const signUpWithPassword = async (email: string, password: string, metadata?: {
    fullName?: string
    firstName?: string
    lastName?: string
  }) => {
    authState.isLoading = true
    authState.error = null

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
          data: {
            full_name: metadata?.fullName,
            first_name: metadata?.firstName,
            last_name: metadata?.lastName,
            email,
            provider: 'email'
          }
        }
      })

      if (error) throw error

      if (data.user && !data.session) {
        authState.success = 'Account created! Please check your email and click the confirmation link to complete setup.'
      } else if (data.session) {
        authState.success = 'Account created and confirmed! Welcome!'
        await ensureUserProfile(data.user!)
      }

      return { success: true, error: null, user: data.user }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.isLoading = false
    }
  }

  // Ensure user profile exists in database
  const ensureUserProfile = async (user: any) => {
    try {      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!existingProfile) {
        const profileData = {
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name,
          first_name: user.user_metadata?.first_name,
          last_name: user.user_metadata?.last_name,
          avatar_url: user.user_metadata?.avatar_url,
          role: 'user',
          subscription_plan: 'free',
          usage_stats: {
            apiCalls: 0,
            storage: 0,
            projects: 0
          },
          created_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('user_profiles')
          .insert(profileData as any)

        if (error) {
          console.error('Error creating user profile:', error)
        }
      }
    } catch (err) {
      console.error('Error ensuring user profile:', err)
    }
  }

  // Enhanced sign out
  const signOut = async () => {
    authState.isLoading = true
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // Clear any client-side state
      await router.push('/auth/login')
      return { success: true, error: null }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.isLoading = false
    }
  }

  // Password reset
  const resetPassword = async (email: string) => {
    authState.isLoading = true
    authState.error = null

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) throw error

      authState.success = 'Password reset email sent! Check your inbox.'
      return { success: true, error: null }
    } catch (err: any) {
      authState.error = err.message
      return { success: false, error: err.message }
    } finally {
      authState.isLoading = false
    }
  }

  return {
    authState: readonly(authState),
    user: readonly(user),
    signInWithGoogle,
    signInWithGitHub,
    sendMagicLink,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    resetPassword,
    ensureUserProfile
  }
}
