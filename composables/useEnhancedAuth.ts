/**
 * Enhanced Authentication Composable
 * Provides improved magic link and OAuth authentication functionality
 */

import type { Provider } from '@supabase/supabase-js'

export interface AuthError {
  message: string
  type: 'validation' | 'network' | 'auth' | 'rate_limit' | 'unknown'
  provider?: string
}

export interface AuthState {
  isLoading: boolean
  error: AuthError | null
  success: string | null
  socialLoading: Provider | null
}

export const useEnhancedAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  
  // Reactive state
  const authState = ref<AuthState>({
    isLoading: false,
    error: null,
    success: null,
    socialLoading: null
  })

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Enhanced magic link authentication
  const sendMagicLink = async (email: string): Promise<{ success: boolean; error?: AuthError }> => {
    if (!email) {
      return {
        success: false,
        error: { message: 'Email is required', type: 'validation' }
      }
    }

    if (!validateEmail(email)) {
      return {
        success: false,
        error: { message: 'Please enter a valid email address', type: 'validation' }
      }
    }

    authState.value.isLoading = true
    authState.value.error = null
    authState.value.success = null

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=magiclink`,
          shouldCreateUser: true,
          data: {
            email,
            provider: 'magic_link',
            created_at: new Date().toISOString()
          }
        }
      })

      if (error) {
        let authError: AuthError

        if (error.message.includes('rate limit') || error.message.includes('too many')) {
          authError = { message: 'Too many requests. Please wait a moment before requesting another magic link.', type: 'rate_limit' }
        } else if (error.message.includes('invalid email') || error.message.includes('email')) {
          authError = { message: 'Please enter a valid email address.', type: 'validation' }
        } else if (error.message.includes('signup disabled') || error.message.includes('not enabled')) {
          authError = { message: 'Magic link signup is currently disabled. Please try password login or contact support.', type: 'auth' }
        } else {
          authError = { message: `Failed to send magic link: ${error.message}`, type: 'auth' }
        }

        return { success: false, error: authError }
      }

      authState.value.success = `Magic link sent to ${email}! Check your email and spam folder. The link will expire in 1 hour.`
      
      // Auto-clear success message after 10 seconds
      setTimeout(() => {
        authState.value.success = null
      }, 10000)

      return { success: true }
    } catch (err: any) {
      let authError: AuthError

      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        authError = { message: 'Network error. Please check your internet connection and try again.', type: 'network' }
      } else if (err.message.includes('timeout')) {
        authError = { message: 'Request timed out. Please try again in a moment.', type: 'network' }
      } else {
        authError = { message: 'Failed to send magic link. Please try again or use password login.', type: 'unknown' }
      }

      return { success: false, error: authError }
    } finally {
      authState.value.isLoading = false
    }
  }

  // Enhanced OAuth authentication
  const signInWithOAuth = async (provider: Provider): Promise<{ success: boolean; error?: AuthError }> => {
    authState.value.socialLoading = provider
    authState.value.error = null
    authState.value.success = null

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?type=oauth&provider=${provider}`,
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'consent'
          } : undefined,
          scopes: provider === 'github' ? 'read:user user:email' : (provider === 'google' ? 'email profile' : undefined)
        }
      })

      if (error) {
        let authError: AuthError

        if (error.message.includes('popup') || error.message.includes('blocked')) {
          authError = { 
            message: 'Popup was blocked. Please allow popups for this site and try again.', 
            type: 'auth', 
            provider 
          }
        } else if (error.message.includes('network') || error.message.includes('offline')) {
          authError = { 
            message: 'Network error. Please check your internet connection and try again.', 
            type: 'network', 
            provider 
          }
        } else if (error.message.includes('not enabled') || error.message.includes('disabled')) {
          authError = { 
            message: `${provider} sign-in is currently disabled. Please try password login or contact support.`, 
            type: 'auth', 
            provider 
          }
        } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
          authError = { 
            message: `${provider} sign-in access is restricted. Please contact support.`, 
            type: 'auth', 
            provider 
          }
        } else {
          authError = { 
            message: `${provider} sign-in failed: ${error.message}`, 
            type: 'auth', 
            provider 
          }
        }

        return { success: false, error: authError }
      }

      // OAuth redirect will happen automatically
      return { success: true }
    } catch (err: any) {
      let authError: AuthError

      if (err.name === 'NetworkError' || err.message.includes('fetch')) {
        authError = { 
          message: 'Network error. Please check your internet connection and try again.', 
          type: 'network', 
          provider 
        }
      } else if (err.message.includes('timeout')) {
        authError = { 
          message: 'Request timed out. Please try again in a moment.', 
          type: 'network', 
          provider 
        }
      } else {
        authError = { 
          message: `Failed to sign in with ${provider}. Please try password login or contact support.`, 
          type: 'unknown', 
          provider 
        }
      }

      return { success: false, error: authError }
    } finally {
      authState.value.socialLoading = null
    }
  }

  // Clear authentication state
  const clearAuthState = () => {
    authState.value.error = null
    authState.value.success = null
    authState.value.isLoading = false
    authState.value.socialLoading = null
  }

  // Set error state
  const setError = (error: AuthError) => {
    authState.value.error = error
  }

  // Set success state
  const setSuccess = (message: string) => {
    authState.value.success = message
  }

  return {
    // State
    authState: readonly(authState),
    user,
    
    // Methods
    sendMagicLink,
    signInWithOAuth,
    validateEmail,
    clearAuthState,
    setError,
    setSuccess,
    
    // Computed
    isLoading: computed(() => authState.value.isLoading),
    error: computed(() => authState.value.error),
    success: computed(() => authState.value.success),
    socialLoading: computed(() => authState.value.socialLoading)
  }
}
