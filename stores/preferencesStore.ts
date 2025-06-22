import { defineStore } from 'pinia'

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
  dateFormat: string
  emailNotifications: boolean
  pushNotifications: boolean
  projectUpdates: boolean
  marketingEmails: boolean
  profilePublic: boolean
  showActivity: boolean
  allowContact: boolean
}

interface PreferencesState {
  preferences: UserPreferences
  loading: boolean
  error: string | null
  hasUnsavedChanges: boolean
}

const defaultPreferences: UserPreferences = {
  theme: 'auto',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  emailNotifications: true,
  pushNotifications: true,
  projectUpdates: true,
  marketingEmails: false,
  profilePublic: false,
  showActivity: true,
  allowContact: true,
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): PreferencesState => ({
    preferences: { ...defaultPreferences },
    loading: false,
    error: null,
    hasUnsavedChanges: false,
  }),

  getters: {
    isDarkMode: (state) => {
      if (state.preferences.theme === 'dark') return true
      if (state.preferences.theme === 'light') return false
      // Auto mode - check system preference
      return typeof window !== 'undefined' 
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false
    },

    notificationSettings: (state) => ({
      email: state.preferences.emailNotifications,
      push: state.preferences.pushNotifications,
      projects: state.preferences.projectUpdates,
      marketing: state.preferences.marketingEmails,
    }),

    privacySettings: (state) => ({
      publicProfile: state.preferences.profilePublic,
      showActivity: state.preferences.showActivity,
      allowContact: state.preferences.allowContact,
    }),
  },

  actions: {
    async loadPreferences(): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // For now, load from localStorage - in future this would connect to Supabase
        const stored = localStorage.getItem('user-preferences')
        if (stored) {
          const parsedPreferences = JSON.parse(stored)
          this.preferences = { ...defaultPreferences, ...parsedPreferences }
        }
        this.hasUnsavedChanges = false
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load preferences'
        console.error('Error loading preferences:', error)
        // Fallback to defaults
        this.preferences = { ...defaultPreferences }
      } finally {
        this.loading = false
      }
    },

    async savePreferences(): Promise<boolean> {
      this.loading = true
      this.error = null

      try {
        // For now, save to localStorage - in future this would connect to Supabase
        localStorage.setItem('user-preferences', JSON.stringify(this.preferences))
        this.hasUnsavedChanges = false
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to save preferences'
        console.error('Error saving preferences:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
      this.preferences[key] = value
      this.hasUnsavedChanges = true
    },

    setTheme(theme: UserPreferences['theme']): void {
      this.updatePreference('theme', theme)
      this.applyTheme()
    },

    applyTheme(): void {
      if (typeof document === 'undefined') return
      
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },

    setEmailNotifications(enabled: boolean): void {
      this.updatePreference('emailNotifications', enabled)
    },

    setPushNotifications(enabled: boolean): void {
      this.updatePreference('pushNotifications', enabled)
    },

    setProjectUpdates(enabled: boolean): void {
      this.updatePreference('projectUpdates', enabled)
    },

    setMarketingEmails(enabled: boolean): void {
      this.updatePreference('marketingEmails', enabled)
    },

    setProfilePublic(isPublic: boolean): void {
      this.updatePreference('profilePublic', isPublic)
    },

    setShowActivity(show: boolean): void {
      this.updatePreference('showActivity', show)
    },

    setAllowContact(allow: boolean): void {
      this.updatePreference('allowContact', allow)
    },

    resetToDefaults(): void {
      this.preferences = { ...defaultPreferences }
      this.hasUnsavedChanges = true
    },

    clearError(): void {
      this.error = null
    },

    // Auto-save functionality
    async autoSave(): Promise<void> {
      if (this.hasUnsavedChanges) {
        await this.savePreferences()
      }
    },

    // Initialize preferences on app start
    async initialize(): Promise<void> {
      await this.loadPreferences()
      this.applyTheme()
      
      // Set up auto-save interval (every 30 seconds)
      if (typeof window !== 'undefined') {
        setInterval(() => {
          this.autoSave()
        }, 30000)
      }
    },
  },
})
