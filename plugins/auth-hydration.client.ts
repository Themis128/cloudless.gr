export default defineNuxtPlugin(() => {
  // This plugin ensures authentication state is properly initialized on the client side
  // to prevent hydration mismatches

  const authStore = useAuthStore()

  // Initialize auth state from localStorage if available
  if (process.client) {
    // Check if we have stored auth data
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')

    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser)
        authStore.setToken(storedToken)
        authStore.setUser(user)
      } catch (error) {
        console.warn('Failed to restore auth state from localStorage:', error)
        // Clear invalid stored data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
  }
})
