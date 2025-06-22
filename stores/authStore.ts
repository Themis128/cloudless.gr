import { navigateTo } from '#app'
import { defineStore } from 'pinia'
import type { Database } from '~/types/supabase.d'

// Helper function for API calls with timeout and retry
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000, retries = 3): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  const fetchOptions = {
    ...options,
    signal: controller.signal
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (attempt === retries) {
        console.error(`API call failed after ${retries} attempts:`, error)
        throw error
      }
      
      console.warn(`API call attempt ${attempt} failed, retrying...`, error)
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
  
  throw new Error('Max retries exceeded')
}

interface AuthUser {
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

interface AuthResponse {
  success: boolean
  user?: AuthUser
  error?: string
  message?: string
  requiresEmailVerification?: boolean
  isLocked?: boolean
}

export const useAuthStore = defineStore('auth', {  state: () => ({
    user: null as AuthUser | null,
    loading: false,
    error: null as string | null,
    successMessage: null as string | null,
    isAuthenticated: false,
  }),

  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    isActive: (state) => state.user?.is_active ?? false,
    isEmailVerified: (state) => state.user?.email_verified ?? false,
    isAccountLocked: (state) => {
      if (!state.user?.locked_until) return false
      return new Date(state.user.locked_until) > new Date()
    },
  },

  actions: {    async initialize() {
      const user = useSupabaseUser()
      
      if (user.value && !this.user) {
        await this.fetchUserProfile(user.value.id)
      }
    },    async fetchUserProfile(userId: string): Promise<AuthUser | null> {
      const supabase = useSupabaseClient<Database>()
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error && error.code === 'PGRST116') {
          // Profile doesn't exist, create one
          console.log('Profile not found, creating new profile for user:', userId)
          return await this.createUserProfile(userId)
        }

        if (error) throw error

        if (data) {
          this.user = data as AuthUser
          this.isAuthenticated = true
          return data as AuthUser
        }
        
        return null
      } catch (err) {
        console.error('Error fetching user profile:', err)
        return null
      }
    },

    async createUserProfile(userId: string): Promise<AuthUser | null> {
      const supabase = useSupabaseClient<Database>()
      
      try {
        // Get user info from auth.users
        const { data: user } = await supabase.auth.getUser()
        if (!user.user || user.user.id !== userId) {
          throw new Error('Cannot create profile for different user')
        }

        const profileData = {
          id: userId,
          email: user.user.email || '',
          full_name: user.user.user_metadata?.full_name || '',
          role: 'user' as const,
          is_active: true,
          email_verified: !!user.user.email_confirmed_at,
          failed_login_attempts: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single()

        if (error) throw error

        if (data) {
          this.user = data as AuthUser
          this.isAuthenticated = true
          return data as AuthUser
        }

        return null
      } catch (err) {
        console.error('Error creating user profile:', err)
        return null
      }
    },    async signIn(email: string, password: string, requireAdmin = false): Promise<AuthResponse> {
      this.loading = true
      this.error = null
      this.successMessage = null

      try {        const supabase = useSupabaseClient<Database>()
          // Check profile via server API (needed because of RLS policies)
        const response = await fetchWithTimeout('/api/auth/check-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        }, 15000, 3) // 15 second timeout, 3 retries
        
        const profileResponse = await response.json() as { exists: boolean; error?: string; profile?: { locked_until?: string; failed_login_attempts: number; role: string; is_active: boolean } }

        if (!profileResponse.exists) {
          return {
            success: false,
            error: profileResponse.error || 'No account found with this email address.'
          }
        }

        const profileCheck = profileResponse.profile

        if (profileCheck?.locked_until) {
          const lockTime = new Date(profileCheck.locked_until)
          if (lockTime > new Date()) {
            return {
              success: false,
              error: 'Account is temporarily locked due to multiple failed login attempts.',
              isLocked: true
            }
          }
        }

        // Check admin requirement before auth attempt
        // Note: Admin users can login as regular users (requireAdmin=false)
        // But regular users cannot login as admins (requireAdmin=true)
        if (requireAdmin && profileCheck?.role !== 'admin') {
          return {
            success: false,
            error: 'Admin access required. Please use admin login.'
          }
        }

        // Check if account is active
        if (profileCheck && !profileCheck.is_active) {
          return {
            success: false,
            error: 'Account is deactivated. Please contact support.'
          }
        }

        // Attempt authentication
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          // Increment failed login attempts
          await this.incrementFailedLogin(email)
          throw error
        }

        if (!data.user) {
          throw new Error('Login failed - no user data received')
        }

        // Reset failed login attempts and update last login
        await this.resetFailedLogin(email)
        
        // Fetch and set user profile
        const profile = await this.fetchUserProfile(data.user.id)
        
        if (!profile) {
          throw new Error('User profile not found')
        }        // Log successful login with role information
        console.log(`✅ Login successful: ${profile.email} (Role: ${profile.role}, AdminRequired: ${requireAdmin})`)

        // Set success message
        const welcomeMessage = requireAdmin 
          ? `Welcome back, Admin ${profile.full_name || profile.email}!`
          : `Welcome back, ${profile.full_name || profile.email}!`
        
        this.successMessage = welcomeMessage

        return {
          success: true,
          user: profile,
          message: welcomeMessage
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Login failed'
        this.error = errorMsg
        return {
          success: false,
          error: errorMsg
        }
      } finally {
        this.loading = false
      }
    },

    async signUp(email: string, password: string, userData: { full_name?: string }): Promise<AuthResponse> {
      this.loading = true
      this.error = null

      try {
        const supabase = useSupabaseClient<Database>()

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: userData
          }
        })

        if (error) throw error

        if (!data.user) {
          throw new Error('Registration failed - no user data received')
        }

        return {
          success: true,
          requiresEmailVerification: !data.user.email_confirmed_at
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Registration failed'
        this.error = errorMsg
        return {
          success: false,
          error: errorMsg
        }
      } finally {
        this.loading = false
      }
    },

    async signOut() {
      const supabase = useSupabaseClient<Database>()
      
      try {
        await supabase.auth.signOut()
        this.user = null
        this.isAuthenticated = false
        this.error = null
        await navigateTo('/auth')
      } catch (err) {
        console.error('Error signing out:', err)
      }
    },

    async sendPasswordReset(email: string): Promise<AuthResponse> {
      this.loading = true
      this.error = null

      try {
        const supabase = useSupabaseClient<Database>()        // Check profile via server API (needed because of RLS policies)
        const response = await fetchWithTimeout('/api/auth/check-profile-for-reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        }, 15000, 3) // 15 second timeout, 3 retries
        
        const profileResponse = await response.json() as { exists: boolean; error?: string; is_active?: boolean }

        if (!profileResponse.exists) {
          throw new Error(profileResponse.error || 'No account found with this email address.')
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

        // Save reset token to database
        await supabase
          .from('profiles')
          .update({
            reset_token: resetToken,
            reset_token_expires: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)

        // Send reset email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password?token=${resetToken}`,
        })

        if (error) throw error

        return { success: true }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Password reset failed'
        this.error = errorMsg
        return {
          success: false,
          error: errorMsg
        }
      } finally {
        this.loading = false
      }
    },    async incrementFailedLogin(email: string) {
      try {
        await fetchWithTimeout('/api/auth/increment-failed-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email })
        }, 10000, 2) // 10 second timeout, 2 retries
      } catch (err) {
        console.error('Error incrementing failed login:', err)
      }
    },

    async resetFailedLogin(email: string) {
      const supabase = useSupabaseClient<Database>()
      
      try {
        await supabase
          .from('profiles')
          .update({
            failed_login_attempts: 0,
            locked_until: null,
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
      } catch (err) {
        console.error('Error resetting failed login:', err)
      }
    },

    async checkAdminStatus(userId: string): Promise<boolean> {
      try {
        // Use service role to bypass RLS for admin checks
        const { createClient } = await import('@supabase/supabase-js')
        const config = useRuntimeConfig()
        
        // Create service role client
        const serviceClient = createClient(
          config.public.supabaseUrl,
          config.supabaseServiceKey
        )
        
        const { data, error } = await serviceClient
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
        
        if (error) {
          console.error('Error checking admin status:', error)
          return false
        }
        
        return data?.role === 'admin'
      } catch (err) {
        console.error('Error in checkAdminStatus:', err)
        return false
      }
    },    resetState() {
      this.user = null
      this.loading = false
      this.error = null
      this.successMessage = null
      this.isAuthenticated = false
    },

    clearMessages() {
      this.error = null
      this.successMessage = null
    },
  },
})
