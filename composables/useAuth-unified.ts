// Enhanced unified authentication composable
interface AuthUser {
  id: string
  email: string
  name?: string
  role: string
  permissions?: string[]
}

interface AuthSession {
  authenticated: boolean
  user?: AuthUser
  role?: string
  permissions?: string[]
}

export const useAuth = () => {
  // Reactive session state
  const session = ref<AuthSession | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const user = computed(() => session.value?.user)
  const isAuthenticated = computed(() => session.value?.authenticated || false)
  const isAdmin = computed(() => session.value?.role === 'admin')
  const permissions = computed(() => session.value?.permissions || [])

  // Initialize session on mount
  onMounted(async () => {
    await checkSession()
  })

  // Check current session status
  const checkSession = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<AuthSession>('/api/auth/session')
      session.value = response
      
      // Update Nuxt app context
      const nuxtApp = useNuxtApp()
      nuxtApp.$auth = response
      
      return response
    } catch (err: any) {
      console.error('Session check error:', err)
      error.value = err.message || 'Failed to check session'
      session.value = { authenticated: false }
      return null
    } finally {
      loading.value = false
    }
  }

  // Unified login function (detects admin vs user based on credentials)
  const login = async (email: string, password: string, rememberMe = false) => {
    loading.value = true
    error.value = null

    try {
      // Try admin login first if email suggests admin
      const isAdminEmail = email.includes('admin') || email.endsWith('@cloudless.gr')
      const endpoint = isAdminEmail ? '/api/auth/admin-login' : '/api/auth/user-login'

      const response = await $fetch(endpoint, {
        method: 'POST',
        body: { email, password, rememberMe }
      })

      if (response.success) {
        // Refresh session after successful login
        await checkSession()
        return { success: true, redirect: response.redirect }
      }

      throw new Error(response.message || 'Login failed')
    } catch (err: any) {
      console.error('Login error:', err)
      error.value = err.message || 'Login failed'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  // Unified logout function
  const logout = async () => {
    loading.value = true
    error.value = null

    try {
      // Determine logout endpoint based on current role
      const endpoint = isAdmin.value ? '/api/auth/admin-logout' : '/api/auth/user-logout'
      
      await $fetch(endpoint, { method: 'POST' })
      
      // Clear session
      session.value = { authenticated: false }
      
      // Update Nuxt app context
      const nuxtApp = useNuxtApp()
      nuxtApp.$auth = { authenticated: false }
      
      // Navigate to appropriate login page
      await navigateTo(isAdmin.value ? '/auth/admin-login' : '/auth/login')
      
      return { success: true }
    } catch (err: any) {
      console.error('Logout error:', err)
      error.value = err.message || 'Logout failed'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  // Role and permission checking utilities
  const hasRole = (roles: string | string[]): boolean => {
    if (!user.value?.role) return false
    const userRole = user.value.role
    return Array.isArray(roles) ? roles.includes(userRole) : userRole === roles
  }

  const hasPermission = (permission: string): boolean => {
    return permissions.value.includes(permission)
  }

  const hasAnyPermission = (permissionsList: string[]): boolean => {
    return permissionsList.some(permission => permissions.value.includes(permission))
  }

  const hasAllPermissions = (permissionsList: string[]): boolean => {
    return permissionsList.every(permission => permissions.value.includes(permission))
  }

  // Refresh session (useful after permission changes)
  const refresh = async () => {
    await checkSession()
  }

  return {
    // State
    user: readonly(user),
    session: readonly(session),
    isAuthenticated: readonly(isAuthenticated),
    isAdmin: readonly(isAdmin),
    permissions: readonly(permissions),
    loading: readonly(loading),
    error: readonly(error),

    // Actions
    login,
    logout,
    checkSession,
    refresh,

    // Utilities
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  }
}
