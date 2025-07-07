import { defineStore } from 'pinia'
import { getSupabaseClient } from '~/composables/useSupabase'
import { useAuthStore } from './authStore'

interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  notifications?: boolean
  timezone?: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    preferences: null as UserPreferences | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    // Get user info from auth store
    profile: () => {
      const authStore = useAuthStore()
      return authStore.user
    },
    
    fullName: () => {
      const authStore = useAuthStore()
      return authStore.user?.full_name || authStore.user?.email || 'User'
    },
    
    isEmailVerified: () => {
      const authStore = useAuthStore()
      return authStore.user?.email_verified ?? false
    },
    
    isActive: () => {
      const authStore = useAuthStore()
      return authStore.user?.is_active ?? false
    },
    
    isUser: () => {
      const authStore = useAuthStore()
      return authStore.user?.role === 'user'
    },
    
    currentTheme: (state) => state.preferences?.theme || 'auto',
  },

  actions: {
    // Initialize user data
    async initialize() {
      const authStore = useAuthStore()
      
      if (authStore.user && authStore.isAuthenticated) {
        await this.loadUserPreferences()
      }
    },

    // Load user preferences (stored locally for now)
    async loadUserPreferences() {
      const authStore = useAuthStore()
      if (!authStore.user) return

      try {
        // For now, use localStorage for preferences since table doesn't exist in DB schema
        const stored = localStorage.getItem(`user_preferences_${authStore.user.id}`)
        
        if (stored) {
          this.preferences = JSON.parse(stored)
        } else {
          this.preferences = {
            theme: 'auto',
            language: 'en',
            notifications: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        }
      } catch (err) {
        console.error('Error loading user preferences:', err)
        this.preferences = {
          theme: 'auto',
          language: 'en',
          notifications: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }
    },

    // Update user preferences
    async updatePreferences(newPreferences: Partial<UserPreferences>): Promise<{ success: boolean; error?: string }> {
      const authStore = useAuthStore()
      if (!authStore.user) {
        return { success: false, error: 'No user profile loaded' }
      }

      try {
        const updatedPreferences = { ...this.preferences, ...newPreferences }
        
        // Store locally for now
        localStorage.setItem(
          `user_preferences_${authStore.user.id}`, 
          JSON.stringify(updatedPreferences)
        )

        this.preferences = updatedPreferences
        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Preferences update failed'
        console.error('Error updating preferences:', err)
        return { success: false, error: errorMsg }
      }
    },

    // Change password
    async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
      const supabase = getSupabaseClient()
      
      try {
        // Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        })

        if (updateError) throw updateError

        return { success: true }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Password change failed'
        console.error('Error changing password:', err)
        return { success: false, error: errorMsg }
      }
    },

    // Legacy methods for compatibility
    async fetchUserProfile() {
      // This is now handled by the auth store
      await this.initialize()
    },

    isAdmin() {
      const authStore = useAuthStore()
      return authStore.user?.role === 'admin'
    },

    async logout() {
      const authStore = useAuthStore()
      await authStore.signOut()
      this.resetStore()
    },

    // Reset store
    resetStore() {
      this.preferences = null
      this.loading = false
      this.error = null
    },
  },
})
