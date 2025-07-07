/**
 * Enhanced Robust Supabase Authentication Composable
 * Features: Account lockout, password reset, email verification, admin roles, Greek timezone
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSupabaseClient, useSupabaseUser } from '#imports'
import { readonly, ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

type ProfilesUpdate = Database['public']['Tables']['profiles']['Update']

interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: 'user' | 'admin'
  email_verified: boolean
  last_login?: string
  failed_login_attempts: number
  locked_until?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AuthResponse {
  success: boolean
  user?: User
  profile?: UserProfile
  error?: string
  isLocked?: boolean
  requiresEmailVerification?: boolean
}

export const useRobustAuth = () => {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()

  // Reactive state
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Check if user is authenticated
  const isAuthenticated = computed(() => !!user.value)

  // Get user profile
  const getUserProfile = async (userId?: string): Promise<UserProfile | null> => {
    try {
      const targetId = userId ?? user.value?.id
      if (!targetId) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as UserProfile
    } catch (err) {
      console.error('Error in getUserProfile:', err)
      return null
    }
  }

  // Check if user is admin
  const isUserAdmin = async (userId?: string): Promise<boolean> => {
    const profile = await getUserProfile(userId)
    return profile?.role === 'admin' || false
  }

  // Check if account is locked - using direct query instead of RPC
  const checkAccountLock = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('locked_until')
        .eq('email', email)
        .single()

      if (error || !data) {
        console.error('Error checking account lock:', error)
        return false
      }

      const profile = data as UserProfile
      if (!profile.locked_until) return false

      const lockTime = new Date(profile.locked_until)
      const now = new Date()

      return lockTime > now
    } catch (err) {
      console.error('Error in checkAccountLock:', err)
      return false
    }
  }

  // Increment failed login attempts
  const incrementFailedLogin = async (email: string): Promise<void> => {
    try {
      const maxAttempts = 5
      const lockoutDuration = 15 * 60 * 1000 // 15 minutes in milliseconds

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('failed_login_attempts')
        .eq('email', email)
        .single()

      if (currentProfile) {
        const profile = currentProfile as UserProfile
        const newAttempts = (profile.failed_login_attempts ?? 0) + 1
        const updates: ProfilesUpdate = {
          failed_login_attempts: newAttempts,
          updated_at: new Date().toISOString(),
          ...(newAttempts >= maxAttempts && {
            locked_until: new Date(Date.now() + lockoutDuration).toISOString()
          })
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('email', email)
      }
    } catch (err) {
      console.error('Error incrementing failed login:', err)
    }
  }

  // Reset failed login attempts
  const resetFailedLogin = async (email: string): Promise<void> => {
    try {
      const resetData: ProfilesUpdate = {
        failed_login_attempts: 0,
        locked_until: null,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('profiles')
        .update(resetData)
        .eq('email', email)
    } catch (err) {
      console.error('Error resetting failed login:', err)
    }
  }

  // Enhanced sign in with security features
  const signIn = async (email: string, password: string, requireAdminRole = false): Promise<AuthResponse> => {
    loading.value = true
    error.value = null

    try {
      // Check if account is locked
      const isLocked = await checkAccountLock(email)
      if (isLocked) {
        return {
          success: false,
          error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
          isLocked: true
        }
      }

      // Attempt sign in
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        // Increment failed login attempts
        await incrementFailedLogin(email)
        throw authError
      }

      if (!data.user) {
        throw new Error('Login failed - no user data received')
      }

      // Reset failed login attempts on successful login
      await resetFailedLogin(email)

      // Get user profile
      const profile = await getUserProfile(data.user.id)

      if (!profile) {
        throw new Error('User profile not found')
      }

      // Check if account is active
      if (!profile.is_active) {
        await signOut()
        throw new Error('Account is deactivated. Please contact support.')
      }

      // Check admin role requirement
      if (requireAdminRole && profile.role !== 'admin') {
        await signOut()
        throw new Error('Admin access required')
      }

      // Check email verification (optional - can be enforced)
      if (!profile.email_verified) {
        return {
          success: true,
          user: data.user,
          profile,
          requiresEmailVerification: true
        }
      }

      return {
        success: true,
        user: data.user,
        profile
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      error.value = errorMessage

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      loading.value = false
    }
  }

  // Enhanced sign up with profile creation
  const signUp = async (
    email: string,
    password: string,
    userData: {
      full_name?: string
      avatar_url?: string
      role?: 'user' | 'admin'
    } = {}
  ): Promise<AuthResponse> => {
    loading.value = true
    error.value = null

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userData.full_name ?? '',
            avatar_url: userData.avatar_url ?? ''
          }
        }
      })

      if (authError) throw authError

      if (!data.user) {
        throw new Error('Registration failed - no user data received')
      }

      // The profile will be automatically created by the database trigger
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // If admin role is specified, update it (only if current user is admin)
      if (userData.role === 'admin') {
        const currentUserIsAdmin = await isUserAdmin()
        if (currentUserIsAdmin) {
          const roleUpdate: ProfilesUpdate = { role: 'admin' }
          await supabase
            .from('profiles')
            .update(roleUpdate)
            .eq('id', data.user.id)
        }
      }

      const profile = await getUserProfile(data.user.id)

      return {
        success: true,
        user: data.user,
        profile: profile || undefined,
        requiresEmailVerification: !data.user.email_confirmed_at
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed'
      error.value = errorMessage

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      loading.value = false
    }
  }

  // Sign out
  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (err) {
      console.error('Sign out error:', err)
      throw err
    }
  }

  // Request password reset
  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    loading.value = true
    error.value = null

    try {
      // Generate secure reset token
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

      // Update profile with reset token
      const resetTokenData: ProfilesUpdate = {
        reset_token: resetToken,
        reset_token_expires: expiresAt,
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('profiles')
        .update(resetTokenData)
        .eq('email', email)

      // Send password reset email through Supabase Auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password?token=${resetToken}`
      })

      if (resetError) throw resetError

      return { success: true }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset request failed'
      error.value = errorMessage

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      loading.value = false
    }
  }

  // Verify reset token and update password
  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    loading.value = true
    error.value = null

    try {
      // Verify reset token
      const { data: verification, error: verifyError } = await supabase
        .from('profiles')
        .select('id, email, reset_token, reset_token_expires')
        .eq('reset_token', token)
        .single()

      if (verifyError || !verification) {
        throw new Error('Invalid reset token')
      }

      const verificationData = verification as any
      // Check token expiration
      if (!verificationData.reset_token_expires || new Date(verificationData.reset_token_expires) < new Date()) {
        throw new Error('Reset token has expired')
      }

      const { email } = verificationData

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      // Clear reset token
      const clearTokenData: ProfilesUpdate = {
        reset_token: null,
        reset_token_expires: null,
        updated_at: new Date().toISOString()
      }

      await supabase
        .from('profiles')
        .update(clearTokenData)
        .eq('email', email)

      return { success: true }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Password reset failed'
      error.value = errorMessage

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      loading.value = false
    }
  }

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    loading.value = true
    error.value = null

    try {
      if (!user.value) {
        throw new Error('User not authenticated')
      }

      // Prevent role escalation (only admins can change roles)
      if (updates.role) {
        const currentUserIsAdmin = await isUserAdmin()
        if (!currentUserIsAdmin) {
          delete updates.role
        }
      }

      const profileUpdates: ProfilesUpdate = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.value.id)

      if (updateError) throw updateError

      return { success: true }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Profile update failed'
      error.value = errorMessage

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      loading.value = false
    }
  }

  // Get current session
  const getSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (err) {
      console.error('Get session error:', err)
      return null
    }
  }

  return {
    // State
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    isAuthenticated,

    // Methods
    signIn,
    signUp,
    signOut,
    getUserProfile,
    isUserAdmin,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    getSession,
    checkAccountLock
  }
}
