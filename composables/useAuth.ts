import type { User, Session, AuthError } from '@supabase/supabase-js'
import { useCustomSupabaseClient } from './useCustomSupabaseClient'

export interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  role: 'user' | 'admin' | 'moderator'
  is_active: boolean
  email_verified: boolean
  failed_login_attempts: number
  locked_until?: string | null
  last_login?: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  success: boolean
  user?: AuthUser
  error?: string
  message?: string
  requiresEmailVerification?: boolean
  isLocked?: boolean
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends SignInCredentials {
  full_name?: string
  metadata?: Record<string, unknown>
}

/**
 * Authentication composable following Supabase best practices
 */
export function useAuth() {
  const supabase = useCustomSupabaseClient()
  
  /**
   * Sign in with email and password
   */
  async function signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      console.log('[AUTH] Attempting sign in for:', credentials.email)
      
      // Validate input
      if (!credentials.email?.trim()) {
        throw new Error('Email is required')
      }
      if (!credentials.password) {
        throw new Error('Password is required')
      }
      
      // Check if user profile exists and is not locked
      const profileCheck = await checkUserProfile(credentials.email)
      if (!profileCheck.success) {
        return profileCheck
      }
      
      // Attempt authentication with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })
      
      if (error) {
        console.error('[AUTH] Sign in error:', error.message)
        
        // Increment failed login attempts
        await incrementFailedLogin(credentials.email)
        
        // Return user-friendly error message
        return {
          success: false,
          error: getAuthErrorMessage(error)
        }
      }
      
      if (!data.user) {
        throw new Error('No user data returned from authentication')
      }
      
      console.log('[AUTH] Sign in successful for:', data.user.email)
      
      // Reset failed login attempts on success
      await resetFailedLogin(credentials.email)
      
      // Fetch user profile
      const userProfile = await fetchUserProfile(data.user.id)
      if (!userProfile) {
        console.warn('[AUTH] User profile not found, creating one...')
        const newProfile = await createUserProfile(data.user.id, data.user.email!, credentials.email)
        if (!newProfile) {
          throw new Error('Failed to create user profile')
        }
        return {
          success: true,
          user: newProfile,
          message: 'Welcome! Your profile has been created.'
        }
      }
      
      // Update last login
      await updateLastLogin(credentials.email)
      
      return {
        success: true,
        user: userProfile,
        message: `Welcome back, ${userProfile.full_name || userProfile.email}!`
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      console.error('[AUTH] Sign in exception:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
  
  /**
   * Sign up with email and password
   */
  async function signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      console.log('[AUTH] Attempting sign up for:', credentials.email)
      
      // Validate input
      if (!credentials.email?.trim()) {
        throw new Error('Email is required')
      }
      if (!credentials.password) {
        throw new Error('Password is required')
      }
      if (credentials.password.length < 6) {
        throw new Error('Password must be at least 6 characters long')
      }
      
      // Check if user already exists
      const existingProfile = await checkUserExists(credentials.email)
      if (existingProfile) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in instead.'
        }
      }
      
      // Attempt registration with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.full_name || '',
            ...credentials.metadata
          }
        }
      })
      
      if (error) {
        console.error('[AUTH] Sign up error:', error.message)
        return {
          success: false,
          error: getAuthErrorMessage(error)
        }
      }
      
      if (!data.user) {
        throw new Error('No user data returned from registration')
      }
      
      console.log('[AUTH] Sign up successful for:', data.user.email)
      
      // Create user profile
      const userProfile = await createUserProfile(
        data.user.id, 
        data.user.email!, 
        credentials.full_name
      )
      
      return {
        success: true,
        user: userProfile || undefined,
        requiresEmailVerification: !data.user.email_confirmed_at,
        message: data.user.email_confirmed_at 
          ? 'Account created successfully!' 
          : 'Please check your email to verify your account.'
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      console.error('[AUTH] Sign up exception:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
  
  /**
   * Reset password via email
   */
  async function resetPassword(email: string): Promise<AuthResponse> {
    try {
      console.log('[AUTH] Attempting password reset for:', email)
      
      // Validate input
      if (!email?.trim()) {
        throw new Error('Email is required')
      }
      
      // Check if user exists
      const userExists = await checkUserExists(email)
      if (!userExists) {
        // For security, don't reveal if email doesn't exist
        return {
          success: true,
          message: 'If an account with this email exists, you will receive a password reset link.'
        }
      }
      
      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      
      if (error) {
        console.error('[AUTH] Password reset error:', error.message)
        return {
          success: false,
          error: getAuthErrorMessage(error)
        }
      }
      
      console.log('[AUTH] Password reset email sent successfully')
      return {
        success: true,
        message: 'Password reset link sent to your email address.'
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed'
      console.error('[AUTH] Password reset exception:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
  
  /**
   * Sign out current user
   */
  async function signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AUTH] Signing out user...')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[AUTH] Sign out error:', error.message)
        return {
          success: false,
          error: error.message
        }
      }
      
      console.log('[AUTH] Sign out successful')
      return { success: true }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed'
      console.error('[AUTH] Sign out exception:', errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
  
  /**
   * Get current session
   */
  async function getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('[AUTH] Error getting session:', error.message)
        return null
      }
      
      return session
    } catch (error) {
      console.error('[AUTH] Exception getting session:', error)
      return null
    }
  }
  
  /**
   * Get current user
   */
  async function getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('[AUTH] Error getting user:', error.message)
        return null
      }
      
      return user
    } catch (error) {
      console.error('[AUTH] Exception getting user:', error)
      return null
    }
  }
  
  return {
    signIn,
    signUp,
    signOut,
    resetPassword,
    getCurrentSession,
    getCurrentUser
  }
}

// Helper functions

async function checkUserProfile(email: string): Promise<AuthResponse> {
  try {
    const supabase = useCustomSupabaseClient()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('locked_until, failed_login_attempts, is_active, role')
      .eq('email', email)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('[AUTH] Error checking profile:', error)
      return {
        success: false,
        error: 'Unable to verify account. Please try again.'
      }
    }
    
    if (!profile) {
      return {
        success: false,
        error: 'No account found with this email address.'
      }
    }
    
    // Check if account is locked
    if (profile.locked_until) {
      const lockTime = new Date(profile.locked_until)
      if (lockTime > new Date()) {
        return {
          success: false,
          error: 'Account is temporarily locked due to multiple failed login attempts.',
          isLocked: true
        }
      }
    }
    
    // Check if account is active
    if (!profile.is_active) {
      return {
        success: false,
        error: 'Account is deactivated. Please contact support.'
      }
    }
    
    return { success: true }
    
  } catch (error) {
    console.error('[AUTH] Exception checking profile:', error)
    return {
      success: false,
      error: 'Unable to verify account. Please try again.'
    }
  }
}

async function checkUserExists(email: string): Promise<boolean> {
  try {
    const supabase = useCustomSupabaseClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()
    
    return !error && !!data
  } catch (error) {
    console.error('[AUTH] Error checking if user exists:', error)
    return false
  }
}

async function fetchUserProfile(userId: string): Promise<AuthUser | null> {
  try {
    const supabase = useCustomSupabaseClient()
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error || !profile) {
      console.error('[AUTH] Error fetching profile:', error)
      return null
    }
    
    return profile as AuthUser
  } catch (error) {
    console.error('[AUTH] Exception fetching profile:', error)
    return null
  }
}

async function createUserProfile(userId: string, email: string, fullName?: string): Promise<AuthUser | null> {
  try {
    const supabase = useCustomSupabaseClient()
    
    const profileData = {
      id: userId,
      email,
      full_name: fullName || '',
      role: 'user' as const,
      is_active: true,
      email_verified: false,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert([profileData])
      .select()
      .single()
    
    if (error) {
      console.error('[AUTH] Error creating profile:', error)
      return null
    }
    
    return profile as AuthUser
  } catch (error) {
    console.error('[AUTH] Exception creating profile:', error)
    return null
  }
}

async function incrementFailedLogin(email: string): Promise<void> {
  try {
    const supabase = useCustomSupabaseClient()
    
    // Get current failed attempts
    const { data: profile } = await supabase
      .from('profiles')
      .select('failed_login_attempts')
      .eq('email', email)
      .single()
    
    if (!profile) return
    
    const newAttempts = (profile.failed_login_attempts || 0) + 1
    const shouldLock = newAttempts >= 5
    
    const updateData: Record<string, unknown> = {
      failed_login_attempts: newAttempts,
      updated_at: new Date().toISOString()
    }
    
    // Lock account if too many attempts
    if (shouldLock) {
      updateData.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    }
    
    await supabase
      .from('profiles')
      .update(updateData)
      .eq('email', email)
      
  } catch (error) {
    console.error('[AUTH] Error incrementing failed login:', error)
  }
}

async function resetFailedLogin(email: string): Promise<void> {
  try {
    const supabase = useCustomSupabaseClient()
    
    await supabase
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      
  } catch (error) {
    console.error('[AUTH] Error resetting failed login:', error)
  }
}

async function updateLastLogin(email: string): Promise<void> {
  try {
    const supabase = useCustomSupabaseClient()
    
    await supabase
      .from('profiles')
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      
  } catch (error) {
    console.error('[AUTH] Error updating last login:', error)
  }
}

function getAuthErrorMessage(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Invalid email or password. Please check your credentials and try again.'
    case 'Email not confirmed':
      return 'Please check your email and click the confirmation link before signing in.'
    case 'Too many requests':
      return 'Too many login attempts. Please wait a moment before trying again.'
    case 'User already registered':
      return 'An account with this email already exists. Please sign in instead.'
    case 'Weak password':
      return 'Password is too weak. Please choose a stronger password.'
    default:
      return error.message || 'Authentication failed. Please try again.'
  }
}
