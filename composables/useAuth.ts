import { computed } from 'vue'
import type { User, LoginCredentials, RegisterData } from '~/types/common'

// Composable that uses the Pinia store
export const useAuth = () => {
  const authStore = useAuthStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    user: computed(() => authStore.user),
    token: computed(() => authStore.token),
    isLoading: computed(() => authStore.isLoading),
    error: computed(() => authStore.error),

    // Computed properties
    isAuthenticated: computed(() => authStore.isAuthenticated),
    isAdmin: computed(() => authStore.isAdmin),
    isDeveloper: computed(() => authStore.isDeveloper),
    isUser: computed(() => authStore.isUser),

    // Methods (delegate to store)
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
    clearAuth: authStore.clearAuth,
    refreshUser: authStore.refreshUser,
    fetchUser: authStore.fetchUser,
    hasPermission: authStore.checkPermission,
    getUserPermissions: authStore.getUserPermissions,
    getUserRoles: authStore.getUserRoles,
    updateProfile: authStore.updateProfile,
    changePassword: authStore.changePassword,
    requestPasswordReset: authStore.requestPasswordReset,
    resetPassword: authStore.resetPassword,
    initializeAuth: authStore.initializeAuth,
    getRedirectPath: authStore.getRedirectPath,
  }
}
