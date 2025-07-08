import { navigateTo } from '#app'
import { defineStore } from 'pinia'
import { useSupabaseUser } from '#imports'
import { getSupabaseClient } from '~/composables/useSupabase'

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


function initialState() {
  return {
    user: null as AuthUser | null,
    loading: false,
    error: null as string | null,
    successMessage: null as string | null,
    isAuthenticated: false
  }
}

export const useAuthStore = defineStore('auth', {
  state: initialState,
  getters: {
    isAdmin: (state) => state.user?.role === 'admin',
    isModerator: (state) => state.user?.role === 'moderator',
    isUser: (state) => state.user?.role === 'user',
    isActive: (state) => state.user?.is_active ?? false,
    isEmailVerified: (state) => state.user?.email_verified ?? false,
    isAccountLocked: (state) => {
      if (!state.user?.locked_until) return false
      return new Date(state.user.locked_until) > new Date()
    },
    hasRole: (state) => (role: AuthUser['role']) => state.user?.role === role,
    hasAnyRole: (state) => (roles: AuthUser['role'][]) => roles.includes(state.user?.role ?? 'user')
  },
  actions: {
    /**
     * Sign in with email and password using Supabase Auth
     */
    async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
      this.loading = true
      this.error = null
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          this.error = error.message
          return { success: false, error: error.message }
        }
        if (!data.user) {
          this.error = 'No user data returned from Supabase.'
          return { success: false, error: 'No user data returned from Supabase.' }
        }
        // Fetch and set user profile after successful login
        await this.fetchUserProfile(data.user.id)
        this.isAuthenticated = true
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Login failed'
        this.error = errorMsg
        return { success: false, error: errorMsg }
      } finally {
        this.loading = false
      }
    },
    async handlePostLoginRedirect() {
      const role = this.user?.role
      if (!role) return navigateTo('/users')

      switch (role) {
        case 'admin':
          return navigateTo('/admin/dashboard')
        case 'moderator':
          return navigateTo('/moderator/tools')
        default:
          return navigateTo('/users')
      }
    },
    async initialize() {
      const user = useSupabaseUser()
      if (user.value && !this.user) {
        await this.fetchUserProfile(user.value.id)
      }
    },
    async fetchUserProfile(userId: string): Promise<AuthUser | null> {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[authStore] fetchUserProfile error:', error)
        return null
      }

      if (!data) return null

      this.user = data as AuthUser
      this.isAuthenticated = true
      return this.user
    },
    async signOut() {
      const supabase = getSupabaseClient()
      try {
        await supabase.auth.signOut()
        this.resetState()
        await navigateTo('/auth')
      } catch (err) {
        console.error('[authStore] signOut error:', err)
      }
    },
    resetState() {
      Object.assign(this, initialState())
    },
    clearMessages() {
      this.error = null
      this.successMessage = null
    }
  }
})
