import { navigateTo } from '#app'
import { defineStore } from 'pinia'
import { useSupabaseUser } from '#imports'
import { getSupabaseClient } from '~/composables/useSupabase'

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
      // Debug logging should not be here; removed.
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
        // Debug logging should not be here; removed.
        throw error
      }
      
      console.warn(`API call attempt ${attempt} failed, retrying...`, error)
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
  
        // Debug logging should not be here; removed.
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

export const useAuthStore = defineStore('auth', {
  state: () => ({
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
  actions: {
    async signIn(email: string, password: string, requireAdmin = false): Promise<AuthResponse> {
      this.loading = true;
      this.error = null;
      this.successMessage = null;
      try {
        console.log('[AUTH STORE] Getting Supabase client for sign in...');
        
        // Use manual client directly to avoid async import issues
        const { useManualSupabaseClient } = await import('~/composables/useManualSupabase');
        const supabase = useManualSupabaseClient();
        console.log('[AUTH STORE] Manual Supabase client obtained:', !!supabase);
        
        // Get the base URL for API calls (handles both localhost and network access)
        const baseUrl = process.client ? window.location.origin : 'http://localhost:3000';
        console.log('🌐 API Base URL:', baseUrl);
        
        // Check profile via server API (needed because of RLS policies)
        const response = await fetchWithTimeout(`${baseUrl}/api/auth/check-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }, 15000, 3);
        const profileResponse = await response.json() as { exists: boolean; error?: string; profile?: { locked_until?: string; failed_login_attempts: number; role: string; is_active: boolean } };
        if (!profileResponse.exists) {
          return { success: false, error: profileResponse.error || 'No account found with this email address.' };
        }
        const profileCheck = profileResponse.profile;
        if (profileCheck?.locked_until) {
          const lockTime = new Date(profileCheck.locked_until);
          if (lockTime > new Date()) {
            return { success: false, error: 'Account is temporarily locked due to multiple failed login attempts.', isLocked: true };
          }
        }
        if (requireAdmin && profileCheck?.role !== 'admin') {
          return { success: false, error: 'Admin access required. Please use admin login.' };
        }
        if (profileCheck && !profileCheck.is_active) {
          return { success: false, error: 'Account is deactivated. Please contact support.' };
        }
        // Attempt authentication
        console.log('[AUTH STORE] Attempting signInWithPassword with email:', email);
        console.log('[AUTH STORE] Supabase client auth methods available:', !!supabase.auth);
        
        let data, error;
        try {
          console.log('[AUTH STORE] Calling signInWithPassword...');
          const authPromise = supabase.auth.signInWithPassword({ email, password });
          console.log('[AUTH STORE] signInWithPassword promise created, waiting for result...');
          
          // Add timeout to prevent infinite hanging
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Authentication timeout after 15 seconds')), 15000);
          });
          
          const result = await Promise.race([authPromise, timeoutPromise]);
          const authResult = result as { data: { user?: { id: string; email?: string } }; error?: { message: string } };
          data = authResult.data;
          error = authResult.error;
          console.log('[AUTH STORE] signInWithPassword completed - data:', !!data?.user, 'error:', error?.message || 'none');
        
          if (error) {
            console.error('[AUTH STORE] Authentication error:', error);
            await this.incrementFailedLogin(email);
            throw error;
          }
          if (!data.user) {
            console.error('[AUTH STORE] No user data received from signInWithPassword');
            throw new Error('Login failed - no user data received');
          }
        } catch (authError) {
          console.error('[AUTH STORE] Exception during signInWithPassword:', authError);
          throw authError;
        }
        await this.resetFailedLogin(email);
        let profile = await this.fetchUserProfile(data.user.id);
        if (!profile) {
          // Auto-create profile if missing
          profile = await this.createUserProfile(data.user.id);
          if (!profile) {
            throw new Error('User profile not found and could not be created');
          }
        }
        const welcomeMessage = requireAdmin
          ? `Welcome back, Admin ${profile.full_name || profile.email}!`
          : `Welcome back, ${profile.full_name || profile.email}!`;
        this.successMessage = welcomeMessage;
        // Do not redirect here; let the UI handle navigation after login
        return { success: true, user: profile, message: welcomeMessage };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Login failed';
        this.error = errorMsg;
        return { success: false, error: errorMsg };
      } finally {
        this.loading = false;
      }
    },
    async createUserProfile(userId: string): Promise<AuthUser | null> {
      // Use upsert to avoid duplicate key errors and simplify logic
      const supabaseUser = useSupabaseUser()
      try {
        if (!supabaseUser.value || supabaseUser.value.id !== userId) {
          throw new Error('Cannot create profile for different user (must be current user)')
        }
        
        let supabase;
        try {
          const { useManualSupabaseClient } = await import('~/composables/useManualSupabase');
          supabase = useManualSupabaseClient();
          console.log('[AUTH STORE] Using manual client for createUserProfile');
        } catch (manualError) {
          console.warn('[AUTH STORE] Manual client failed in createUserProfile, using fallback:', manualError);
          supabase = getSupabaseClient();
        }
        
        const user = supabaseUser.value
        
        const profileData = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          role: 'user' as const,
          is_active: true,
          email_verified: false,
          failed_login_attempts: 0,
          locked_until: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // @ts-ignore - Supabase types not properly configured for profiles table
        const { data, error } = await supabase
          .from('profiles')
          // @ts-ignore - Type configuration issue with profiles table
          .upsert([profileData], { onConflict: 'id' })
          .select()
          .single()

        if (error) {
          console.error('Error creating user profile (upsert):', error, JSON.stringify(error));
          throw error;
        }

        this.user = data as AuthUser
        this.isAuthenticated = true
        return data as AuthUser
      } catch (err) {
        console.error('Error creating user profile (exception):', err, JSON.stringify(err));
        this.error = err instanceof Error ? err.message : JSON.stringify(err)
        return null
      }
    },
    async initialize() {
      const user = useSupabaseUser()
      if (user.value && !this.user) {
        await this.fetchUserProfile(user.value.id)
      }
    },
    async fetchUserProfile(userId: string): Promise<AuthUser | null> {
      let supabase;
      try {
        const { useManualSupabaseClient } = await import('~/composables/useManualSupabase');
        supabase = useManualSupabaseClient();
        console.log('[AUTH STORE] Using manual client for fetchUserProfile');
      } catch (manualError) {
        console.warn('[AUTH STORE] Manual client failed in fetchUserProfile, using fallback:', manualError);
        supabase = getSupabaseClient();
      }
      try {
        const { data: profile, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
        console.log('[fetchUserProfile] profile:', profile)
        console.log('[fetchUserProfile] selectError:', selectError)
        if (selectError && selectError.code !== 'PGRST116') {
          // Log RLS or DB errors in detail
          console.error('[fetchUserProfile] SELECT error details:', selectError)
          throw selectError
        }
        if (!profile) {
          console.warn('[fetchUserProfile] No profile found for userId:', userId)
          return null
        }
        this.user = profile as AuthUser
        this.isAuthenticated = true
        return profile as AuthUser
      } catch (err) {
        console.error('[fetchUserProfile] Exception:', err)
        return null
      }
    },

    async signUp(email: string, password: string, userData: { full_name?: string }): Promise<AuthResponse> {
      this.loading = true
      this.error = null

      try {        const supabase = getSupabaseClient()
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

        // After successful sign up, create the profile
        await this.createUserProfile(data.user.id)

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
      const supabase = getSupabaseClient()
      
      try {
        await supabase.auth.signOut()
        this.user = null
        this.isAuthenticated = false
        this.error = null
        
        // Use navigation store for centralized logout handling
        const { useNavigationStore } = await import('./navigationStore')
        const navigationStore = useNavigationStore()
        await navigationStore.handlePostLogoutNavigation()
      } catch (err) {
        console.error('Error signing out:', err)
        // Fallback direct navigation
        await navigateTo('/auth')
      }
    },

    async sendPasswordReset(email: string): Promise<AuthResponse> {
      this.loading = true
      this.error = null

      try {
        const supabase = getSupabaseClient()
        
        // Get the base URL for API calls (handles both localhost and network access)
        const baseUrl = process.client ? window.location.origin : 'http://localhost:3000';
        
        // Check profile via server API (needed because of RLS policies)
        const response = await fetchWithTimeout(`${baseUrl}/api/auth/check-profile-for-reset`, {
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
        const updateData = {
          reset_token: resetToken,
          reset_token_expires: expiresAt,
          updated_at: new Date().toISOString(),
        }

        // @ts-ignore - Supabase types not properly configured for profiles table
        await supabase.from('profiles')
          // @ts-ignore - Type configuration issue with profiles table
          .update(updateData)
          .eq('email', email)

        // Send reset email
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/reset-password?token=${resetToken}`,
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
        // Get the base URL for API calls (handles both localhost and network access)
        const baseUrl = process.client ? window.location.origin : 'http://localhost:3000';
        
        await fetchWithTimeout(`${baseUrl}/api/auth/increment-failed-login`, {
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
      const supabase = getSupabaseClient()
      
      try {
        const updateData = {
          failed_login_attempts: 0,
          locked_until: null,
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // @ts-ignore - Supabase types not properly configured for profiles table
        await supabase.from('profiles')
          // @ts-ignore - Type configuration issue with profiles table
          .update(updateData)
          .eq('email', email)
      } catch (err) {
        console.error('Error resetting failed login:', err)
      }
    },

    async checkAdminStatus(userId: string): Promise<boolean> {
      try {
        // Use the singleton client instead of creating a new service client
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()
        
        if (error) {
          console.warn('Error checking admin status (might be RLS):', error.message)
          // If RLS blocks us, default to false (user role)
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

