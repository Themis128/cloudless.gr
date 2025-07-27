import { defineStore } from 'pinia'
import { computed, nextTick, ref } from 'vue'

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  userRoles?: Array<{
    id: number
    role: {
      id: number
      name: string
      description: string
    }
    assignedAt: string
    expiresAt?: string
    isActive: boolean
  }>
}

interface Permission {
  id: number
  name: string
  description: string
  resource: string
  action: string
}

interface Role {
  id: number
  name: string
  description: string
  permissions: Permission[]
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<Permission[]>([])
  const roles = ref<Role[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(
    () =>
      user.value?.role === 'admin' ||
      user.value?.userRoles?.some(ur => ur.role.name === 'admin' && ur.isActive)
  )
  const isDeveloper = computed(
    () =>
      user.value?.role === 'developer' ||
      user.value?.userRoles?.some(ur => ur.role.name === 'developer' && ur.isActive)
  )
  const isUser = computed(
    () =>
      user.value?.role === 'user' ||
      user.value?.userRoles?.some(ur => ur.role.name === 'user' && ur.isActive)
  )

  // Permission checking
  const hasPermission = computed(() => (resource: string, action: string) => {
    return permissions.value.some(p => p.resource === resource && p.action === action)
  })

  const hasAnyPermission = computed(
    () => (permissionList: Array<{ resource: string; action: string }>) => {
      return permissionList.some(({ resource, action }) =>
        permissions.value.some(p => p.resource === resource && p.action === action)
      )
    }
  )

  const hasAllPermissions = computed(
    () => (permissionList: Array<{ resource: string; action: string }>) => {
      return permissionList.every(({ resource, action }) =>
        permissions.value.some(p => p.resource === resource && p.action === action)
      )
    }
  )

  // Common permission checks
  const canManageUsers = computed(() => hasPermission.value('admin', 'users') || isAdmin.value)
  const canManageRoles = computed(() => hasPermission.value('admin', 'roles') || isAdmin.value)
  const canManageBots = computed(
    () =>
      hasPermission.value('bot', 'create') ||
      hasPermission.value('bot', 'update') ||
      hasPermission.value('bot', 'delete')
  )
  const canCreateBots = computed(() => hasPermission.value('bot', 'create'))
  const canUpdateBots = computed(() => hasPermission.value('bot', 'update'))
  const canDeleteBots = computed(() => hasPermission.value('bot', 'delete'))
  const canDeployBots = computed(() => hasPermission.value('bot', 'deploy'))
  const canManageModels = computed(
    () =>
      hasPermission.value('model', 'create') ||
      hasPermission.value('model', 'update') ||
      hasPermission.value('model', 'delete')
  )
  const canCreateModels = computed(() => hasPermission.value('model', 'create'))
  const canUpdateModels = computed(() => hasPermission.value('model', 'update'))
  const canDeleteModels = computed(() => hasPermission.value('model', 'delete'))
  const canTrainModels = computed(() => hasPermission.value('model', 'train'))
  const canManagePipelines = computed(
    () =>
      hasPermission.value('pipeline', 'create') ||
      hasPermission.value('pipeline', 'update') ||
      hasPermission.value('pipeline', 'delete')
  )
  const canCreatePipelines = computed(() => hasPermission.value('pipeline', 'create'))
  const canUpdatePipelines = computed(() => hasPermission.value('pipeline', 'update'))
  const canDeletePipelines = computed(() => hasPermission.value('pipeline', 'delete'))
  const canExecutePipelines = computed(() => hasPermission.value('pipeline', 'execute'))
  const canAccessAnalytics = computed(
    () => hasPermission.value('admin', 'analytics') || isAdmin.value
  )

  // Actions
  const setUser = (newUser: User | null) => {
    user.value = newUser
    // Update localStorage
    if (process.client) {
      if (newUser) {
        localStorage.setItem('auth_user', JSON.stringify(newUser))
      } else {
        localStorage.removeItem('auth_user')
      }
    }
  }

  const setToken = (newToken: string | null) => {
    token.value = newToken
    // Update localStorage
    if (process.client) {
      if (newToken) {
        localStorage.setItem('auth_token', newToken)
      } else {
        localStorage.removeItem('auth_token')
      }
    }
  }

  const setPermissions = (newPermissions: Permission[]) => {
    permissions.value = newPermissions
  }

  const setRoles = (newRoles: Role[]) => {
    roles.value = newRoles
  }

  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  const login = async (credentials: { email: string; password: string }) => {
    try {
      setLoading(true)
      setError(null)

      const response = (await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
      })) as any

      if (response.success) {
        setToken(response.token)
        setUser(response.user)

        // Store in localStorage
        if (process.client) {
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }

        // Fetch permissions and roles
        await fetchUserPermissions()
        await fetchUserRoles()

        return { success: true }
      } else {
        setError(response.message || 'Login failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.data?.message || err.message || 'Login failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: {
    name: string
    email: string
    password: string
    confirmPassword: string
  }) => {
    try {
      setLoading(true)
      setError(null)

      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match')
        return { success: false, error: error.value }
      }

      const response = (await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          name: data.name,
          email: data.email,
          password: data.password,
        },
      })) as any

      if (response.success) {
        setToken(response.token)
        setUser(response.user)

        // Store in localStorage
        if (process.client) {
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }

        // Fetch permissions and roles
        await fetchUserPermissions()
        await fetchUserRoles()

        return { success: true }
      } else {
        setError(response.message || 'Registration failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      setError(err.data?.message || err.message || 'Registration failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token
      if (token.value) {
        await $fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.value}`,
          },
        }).catch(() => {
          // Ignore errors on logout
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearAuth()

      // Navigate to login page
      if (process.client) {
        const router = useRouter()
        if (router) {
          router.push('/auth/login')
        }
      }
    }
  }

  const clearAuth = () => {
    setUser(null)
    setToken(null)
    setPermissions([])
    setRoles([])
    setError(null)

    if (process.client) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  }

  const fetchUserPermissions = async () => {
    if (!token.value) return

    try {
      const response = (await $fetch('/api/auth/permissions', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      if (response.success) {
        setPermissions(response.permissions || [])
      }
    } catch (err) {
      console.error('Error fetching permissions:', err)
    }
  }

  const fetchUserRoles = async () => {
    if (!token.value) return

    try {
      const response = (await $fetch('/api/auth/roles', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      if (response.success) {
        setRoles(response.roles || [])
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
    }
  }

  const refreshUser = async () => {
    if (!token.value) return

    try {
      const response = (await $fetch('/api/auth/user', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      if (response.success) {
        setUser(response.user)

        // Update localStorage
        if (process.client) {
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }

        // Refresh permissions and roles
        await fetchUserPermissions()
        await fetchUserRoles()
      }
    } catch (err) {
      console.error('Error refreshing user:', err)
      // If refresh fails, user might be logged out
      clearAuth()
    }
  }

  const updateProfile = async (profileData: Partial<User>) => {
    if (!token.value) return { success: false, error: 'Not authenticated' }

    try {
      setLoading(true)
      setError(null)

      const response = (await $fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
        body: profileData,
      })) as any

      if (response.success) {
        setUser(response.user)

        // Update localStorage
        if (process.client) {
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }

        return { success: true }
      } else {
        setError(response.message || 'Profile update failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Profile update error:', err)
      setError(err.data?.message || err.message || 'Profile update failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token.value) return { success: false, error: 'Not authenticated' }

    try {
      setLoading(true)
      setError(null)

      const response = (await $fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
        body: {
          currentPassword,
          newPassword,
        },
      })) as any

      if (response.success) {
        return { success: true }
      } else {
        setError(response.message || 'Password change failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err.data?.message || err.message || 'Password change failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = (await $fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      })) as any

      if (response.success) {
        return { success: true }
      } else {
        setError(response.message || 'Password reset request failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password reset request error:', err)
      setError(err.data?.message || err.message || 'Password reset request failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (resetToken: string, newPassword: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = (await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: {
          token: resetToken,
          newPassword,
        },
      })) as any

      if (response.success) {
        return { success: true }
      } else {
        setError(response.message || 'Password reset failed')
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.data?.message || err.message || 'Password reset failed')
      return { success: false, error: error.value }
    } finally {
      setLoading(false)
    }
  }

  // Get redirect path based on user role
  const getRedirectPath = (user: User) => {
    // Check if user is admin
    const isUserAdmin =
      user.role === 'admin' || user.userRoles?.some(ur => ur.role.name === 'admin' && ur.isActive)

    if (isUserAdmin) {
      return '/admin'
    }

    // Check if user is developer
    const isUserDeveloper =
      user.role === 'developer' ||
      user.userRoles?.some(ur => ur.role.name === 'developer' && ur.isActive)

    if (isUserDeveloper) {
      return '/dashboard'
    }

    // Default redirect for regular users
    return '/dashboard'
  }

  // Fetch user data (alias for refreshUser for compatibility)
  const fetchUser = async () => {
    // If no token, try to initialize from localStorage first
    if (!token.value && process.client) {
      initializeAuth()
    }

    // If still no token after initialization, return early
    if (!token.value) {
      console.log('No auth token found, skipping user fetch')
      return
    }

    return await refreshUser()
  }

  // Check if user has specific permission (async version for API calls)
  const checkPermission = async (resource: string, action: string) => {
    if (!isAuthenticated.value) return false

    try {
      const response = (await $fetch('/api/auth/permissions', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      if (response.success) {
        const permissions = response.permissions || []
        return permissions.some((p: any) => p.resource === resource && p.action === action)
      }
      return false
    } catch (err) {
      console.error('Error checking permission:', err)
      return false
    }
  }

  // Get user permissions (async version for API calls)
  const getUserPermissions = async () => {
    if (!isAuthenticated.value) return []

    try {
      const response = (await $fetch('/api/auth/permissions', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      return response.success ? response.permissions || [] : []
    } catch (err) {
      console.error('Error getting permissions:', err)
      return []
    }
  }

  // Get user roles (async version for API calls)
  const getUserRoles = async () => {
    if (!isAuthenticated.value) return []

    try {
      const response = (await $fetch('/api/auth/roles', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })) as any

      return response.success ? response.roles || [] : []
    } catch (err) {
      console.error('Error getting roles:', err)
      return []
    }
  }

  const initializeAuth = () => {
    if (process.client) {
      try {
        const storedToken = localStorage.getItem('auth_token')
        const storedUser = localStorage.getItem('auth_user')

        if (storedToken && storedUser) {
          setToken(storedToken)
          setUser(JSON.parse(storedUser))

          // Fetch permissions and roles asynchronously
          nextTick(() => {
            fetchUserPermissions()
            fetchUserRoles()
          })
        }
      } catch (err) {
        console.error('Error initializing auth:', err)
        clearAuth()
      }
    }
  }

  return {
    // State
    user,
    token,
    permissions,
    roles,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    isAdmin,
    isDeveloper,
    isUser,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canManageUsers,
    canManageRoles,
    canManageBots,
    canCreateBots,
    canUpdateBots,
    canDeleteBots,
    canDeployBots,
    canManageModels,
    canCreateModels,
    canUpdateModels,
    canDeleteModels,
    canTrainModels,
    canManagePipelines,
    canCreatePipelines,
    canUpdatePipelines,
    canDeletePipelines,
    canExecutePipelines,
    canAccessAnalytics,

    // Actions
    setUser,
    setToken,
    setPermissions,
    setRoles,
    setLoading,
    setError,
    login,
    register,
    logout,
    clearAuth,
    fetchUserPermissions,
    fetchUserRoles,
    refreshUser,
    updateProfile,
    changePassword,
    requestPasswordReset,
    resetPassword,
    initializeAuth,
    getRedirectPath,
    fetchUser,
    checkPermission,
    getUserPermissions,
    getUserRoles,
  }
})
