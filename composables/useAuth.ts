import { ref, computed, watch, readonly } from 'vue'


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

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

// Global auth state to ensure persistence across composable calls
let globalUser: User | null = null
let globalToken: string | null = null
let isInitialized = false
let initPromise: Promise<void> | null = null

export const useAuth = () => {
  // Get router only when needed, not during initialization
  const getRouter = () => {
    try {
      return useRouter()
    } catch (error) {
      console.warn('Router not available:', error)
      return null
    }
  }
  
  // Reactive state
  const user = ref<User | null>(globalUser)
  const token = ref<string | null>(globalToken)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Clear auth state
  const clearAuth = () => {
    user.value = null
    token.value = null
    error.value = null
    globalUser = null
    globalToken = null
    
    if (process.client) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  }
  
  // Initialize auth state from localStorage
  const initializeAuth = async () => {
    if (process.client && !isInitialized) {
      if (initPromise) {
        return initPromise
      }
      
      initPromise = new Promise((resolve) => {
        const storedToken = localStorage.getItem('auth_token')
        const storedUser = localStorage.getItem('auth_user')
        
        console.log('Initializing auth state:', { 
          hasStoredToken: !!storedToken, 
          hasStoredUser: !!storedUser,
          isInitialized 
        })
        
        if (storedToken && storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser)
            globalToken = storedToken
            globalUser = parsedUser
            token.value = storedToken
            user.value = parsedUser
            isInitialized = true
            console.log('Auth state initialized from localStorage:', { 
              userId: parsedUser.id, 
              userEmail: parsedUser.email,
              userRole: parsedUser.role 
            })
          } catch (err) {
            console.error('Error parsing stored auth data:', err)
            clearAuth()
          }
        } else {
          console.log('No stored auth data found, marking as initialized')
          isInitialized = true
        }
        resolve()
      })
      
      return initPromise
    } else {
      console.log('Auth initialization skipped:', { 
        isClient: process.client, 
        isInitialized 
      })
    }
  }

  // Initialize auth state immediately if not already done
  if (process.client && !isInitialized) {
    initializeAuth()
  }

  // Computed properties
  const isAuthenticated = computed(() => {
    const authenticated = !!token.value && !!user.value
    console.log('isAuthenticated computed:', { 
      hasToken: !!token.value, 
      hasUser: !!user.value, 
      authenticated 
    })
    return authenticated
  })
  
  const isAdmin = computed(() => {
    const admin = user.value?.role === 'admin' || 
      user.value?.userRoles?.some(ur => ur.role.name === 'admin' && ur.isActive)
    console.log('isAdmin computed:', { 
      userRole: user.value?.role, 
      admin 
    })
    return admin
  })
  
  const isDeveloper = computed(() => user.value?.role === 'developer' || 
    user.value?.userRoles?.some(ur => ur.role.name === 'developer' && ur.isActive))
  const isUser = computed(() => user.value?.role === 'user' || 
    user.value?.userRoles?.some(ur => ur.role.name === 'user' && ur.isActive))

  // Login function
  const login = async (credentials: LoginCredentials) => {
    try {
      isLoading.value = true
      error.value = null

      console.log('Sending login request with credentials:', credentials)

      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: credentials
      }) as any

      if (response.success) {
        token.value = response.token
        user.value = response.user
        globalToken = response.token
        globalUser = response.user
        
        // Store in localStorage
        if (process.client) {
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }
        
        return { success: true, user: response.user }
      } else {
        error.value = response.message || 'Login failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      error.value = err.data?.message || err.message || 'Login failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // Get redirect path based on user role
  const getRedirectPath = (user: User) => {
    // Check if user is admin
    const isUserAdmin = user.role === 'admin' || 
      user.userRoles?.some(ur => ur.role.name === 'admin' && ur.isActive)
    
    if (isUserAdmin) {
      return '/admin'
    }
    
    // Check if user is developer
    const isUserDeveloper = user.role === 'developer' || 
      user.userRoles?.some(ur => ur.role.name === 'developer' && ur.isActive)
    
    if (isUserDeveloper) {
      return '/dashboard'
    }
    
    // Default redirect for regular users
    return '/dashboard'
  }

  // Register function
  const register = async (data: RegisterData) => {
    try {
      isLoading.value = true
      error.value = null

      if (data.password !== data.confirmPassword) {
        error.value = 'Passwords do not match'
        return { success: false, error: error.value }
      }

      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          name: data.name,
          email: data.email,
          password: data.password
        }
      }) as any

      if (response.success) {
        token.value = response.token
        user.value = response.user
        globalToken = response.token
        globalUser = response.user
        
        // Store in localStorage
        if (process.client) {
          localStorage.setItem('auth_token', response.token)
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }
        
        return { success: true }
      } else {
        error.value = response.message || 'Registration failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      error.value = err.data?.message || err.message || 'Registration failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token
      if (token.value) {
        await $fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token.value}`
          }
        }).catch(() => {
          // Ignore errors on logout
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      clearAuth()
      const router = getRouter()
      if (router) {
        router.push('/login')
      }
    }
  }

  // Refresh user data from server
  const refreshUser = async () => {
    if (!token.value) return

    try {
      const response = await $fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      }) as any

      if (response.success) {
        user.value = response.user
        globalUser = response.user
        
        // Update localStorage
        if (process.client) {
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }
      }
    } catch (err) {
      console.error('Error refreshing user:', err)
      // If refresh fails, user might be logged out
      clearAuth()
    }
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

  // Check if user has specific permission
  const hasPermission = async (resource: string, action: string) => {
    if (!isAuthenticated.value) return false

    try {
      const response = await $fetch('/api/auth/permissions', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      }) as any

      if (response.success) {
        const permissions = response.permissions || []
        return permissions.some((p: any) => 
          p.resource === resource && p.action === action
        )
      }
      return false
    } catch (err) {
      console.error('Error checking permission:', err)
      return false
    }
  }

  // Get user permissions
  const getUserPermissions = async () => {
    if (!isAuthenticated.value) return []

    try {
      const response = await $fetch('/api/auth/permissions', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      }) as any

      return response.success ? (response.permissions || []) : []
    } catch (err) {
      console.error('Error getting permissions:', err)
      return []
    }
  }

  // Get user roles
  const getUserRoles = async () => {
    if (!isAuthenticated.value) return []

    try {
      const response = await $fetch('/api/auth/roles', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      }) as any

      return response.success ? (response.roles || []) : []
    } catch (err) {
      console.error('Error getting roles:', err)
      return []
    }
  }

  // Update user profile
  const updateProfile = async (profileData: Partial<User>) => {
    if (!isAuthenticated.value) return { success: false, error: 'Not authenticated' }

    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token.value}`
        },
        body: profileData
      }) as any

      if (response.success) {
        user.value = response.user
        globalUser = response.user
        
        // Update localStorage
        if (process.client) {
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }
        
        return { success: true }
      } else {
        error.value = response.message || 'Profile update failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Profile update error:', err)
      error.value = err.data?.message || err.message || 'Profile update failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // Change password
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!isAuthenticated.value) return { success: false, error: 'Not authenticated' }

    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`
        },
        body: {
          currentPassword,
          newPassword
        }
      }) as any

      if (response.success) {
        return { success: true }
      } else {
        error.value = response.message || 'Password change failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password change error:', err)
      error.value = err.data?.message || err.message || 'Password change failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // Request password reset
  const requestPasswordReset = async (email: string) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email }
      }) as any

      if (response.success) {
        return { success: true }
      } else {
        error.value = response.message || 'Password reset request failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password reset request error:', err)
      error.value = err.data?.message || err.message || 'Password reset request failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  // Reset password with token
  const resetPassword = async (token: string, newPassword: string) => {
    try {
      isLoading.value = true
      error.value = null

      const response = await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: {
          token,
          newPassword
        }
      }) as any

      if (response.success) {
        return { success: true }
      } else {
        error.value = response.message || 'Password reset failed'
        return { success: false, error: error.value }
      }
    } catch (err: any) {
      console.error('Password reset error:', err)
      error.value = err.data?.message || err.message || 'Password reset failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }



  return {
    // State
    user: readonly(user),
    token: readonly(token),
    isLoading: readonly(isLoading),
    error: readonly(error),
    
    // Computed
    isAuthenticated,
    isAdmin,
    isDeveloper,
    isUser,
    
    // Methods
    login,
    register,
    logout,
    clearAuth,
    refreshUser,
    fetchUser,
    hasPermission,
    getUserPermissions,
    getUserRoles,
    updateProfile,
    changePassword,
    requestPasswordReset,
    resetPassword,
    initializeAuth,
    getRedirectPath
  }
} 