// Authentication composable for user management
import { computed } from 'vue'
import type { User } from '~/types/user'

// Re-export types for backward compatibility
interface AuthApiResponse {
  user: User
  token: string
}

interface VerifyApiResponse {
  authenticated: boolean
  user: User
}

// Composable that uses the Pinia store
export const useUserAuth = () => {
  const userStore = useUserStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    isLoggedIn: computed(() => userStore.isLoggedIn),
    currentUser: computed(() => userStore.currentUser),
    isLoading: computed(() => userStore.isLoading),
    authInitialized: computed(() => true), // Always true when using store

    // Error handling (readonly for backward compatibility)
    loginError: computed(() => userStore.error),

    // Methods (delegate to store)
    login: userStore.login,
    signup: userStore.register,
    logout: userStore.logout,
    checkAuthStatus: userStore.fetchUser,
    initializeAuth: userStore.initializeAuth,

    // Additional store methods
    fetchUser: userStore.fetchUser,
    clearError: userStore.clearError,
    setUser: userStore.setUser,

    // Additional computed properties from store
    isAuthenticated: computed(() => userStore.isAuthenticated),
    isAdmin: computed(() => userStore.isAdmin),
    hasError: computed(() => userStore.hasError),

    // Legacy methods for backward compatibility
    async verifyAuthStatus() {
      return await userStore.fetchUser()
    },
  }
}
