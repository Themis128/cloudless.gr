//
// Unified authentication composable
// Uses mock API endpoints for authentication
//

import { navigateTo } from '#imports'
import { computed, onMounted, ref } from '#imports'
import { useUserStore } from '~/stores/useUserStore'

export interface AuthUser {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: string
  permissions?: string[]
  created_at?: string
}

interface AuthResponse {
  valid: boolean
  message: string
  user?: AuthUser
}

interface LoginResponse {
  success: boolean
  message: string
  user?: AuthUser
  token?: string
  expiresAt?: string
}

export function useAuth() {
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const userStore = useUserStore()

  const isAuthenticated = computed(() => !!user.value)

  onMounted(async () => {
    await checkAuthStatus()
  })

  const checkAuthStatus = async () => {
    if (typeof window === 'undefined') return

    try {
      const token = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')

      if (token && storedUser) {
        const response = await $fetch<AuthResponse>('/api/auth/verify-user', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.valid && response.user) {
          user.value = response.user as AuthUser

          const storeUser = {
            ...response.user,
            name:
              response.user.name ||
              `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim(),
            'https://www.cloudless.gr/roles': [response.user.role],
            'https://www.cloudless.gr/permissions': response.user.permissions || [],
          }
          userStore.setUser(storeUser)
        } else {
          await clearSession()
        }
      }
    } catch (err) {
      console.error('Error checking auth status:', err)
      await clearSession()
    }
  }

  const clearSession = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    user.value = null
    userStore.clearUser()
  }

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = false
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<LoginResponse>('/api/auth/user-login', {
        method: 'POST',
        body: {
          email,
          password,
          rememberMe,
        },
      })

      if (response.success && response.user && response.token) {
        localStorage.setItem('auth_token', response.token)
        localStorage.setItem('auth_user', JSON.stringify(response.user))

        user.value = response.user as AuthUser

        const storeUser = {
          ...response.user,
          name:
            response.user.name ||
            `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim() ||
            'User',
          roles: [response.user.role] as any[],
          permissions: response.user.permissions || [],
        }
        userStore.setUser(storeUser)

        return true
      }

      return false
    } catch (err: any) {
      console.error('Login error:', err)
      error.value = err.data?.message || 'Invalid email or password'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true
    error.value = null

    try {
      await clearSession()
      await navigateTo('/auth/login')
    } catch (err) {
      console.error('Logout error:', err)
      error.value = 'Failed to log out'
    } finally {
      isLoading.value = false
    }
  }

  const hasRole = (roles: string | string[]): boolean => {
    if (!user.value?.role) return false
    return Array.isArray(roles)
      ? roles.includes(user.value.role)
      : user.value.role === roles
  }

  const hasPermission = (permission: string): boolean => {
    const permissions = user.value?.permissions || []
    return permissions.includes(permission)
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    hasPermission,
    checkAuthStatus,
  }
}
