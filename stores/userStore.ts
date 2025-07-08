import { defineStore } from 'pinia'
import { getSupabaseClient } from '~/composables/useSupabase'


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
    // No longer using authStore, remove all related getters
    currentTheme: (state) => state.preferences?.theme || 'auto',
  },

  actions: {
    // Initialize user data
    async initialize() {
      // No authStore, just load preferences if needed
      await this.loadUserPreferences()
    },

    // Load user preferences (stored locally for now)
    async loadUserPreferences() {
      // No authStore, so just use a default key for now
      try {
        const stored = localStorage.getItem('user_preferences_default')
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
      try {
        const updatedPreferences = { ...this.preferences, ...newPreferences }
        localStorage.setItem('user_preferences_default', JSON.stringify(updatedPreferences))
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


    async logout() {
      // No authStore, just reset store
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
