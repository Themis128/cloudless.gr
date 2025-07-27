import { defineStore } from 'pinia'
import type { User } from '~/types/common'

// Extend the User interface for this store's specific needs
interface StoreUser extends Omit<User, 'createdAt' | 'updatedAt'> {
  createdAt: Date
  updatedAt: Date
}

interface LoginData {
  email: string
  password: string
}

interface RegisterData {
  email: string
  password: string
  name: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface UserState {
  user: StoreUser | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  }),

  getters: {
    currentUser: state => state.user,
    isLoggedIn: state => state.isAuthenticated && state.user !== null,
    isAdmin: state => state.user?.role === 'admin',
    isLoading: state => state.loading,
    hasError: state => state.error !== null,
  },

  actions: {
    async fetchUser() {
      this.loading = true
      this.error = null

      try {
        const response =
          await $fetch<ApiResponse<{ user: StoreUser | null }>>(
            '/api/auth/user'
          )
        if (response.success && response.data?.user) {
          this.user = response.data.user
          this.isAuthenticated = true
        } else {
          this.user = null
          this.isAuthenticated = false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch user'
        this.user = null
        this.isAuthenticated = false
        console.error('Error fetching user:', error)
      } finally {
        this.loading = false
      }
    },

    async login(loginData: LoginData) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<
          ApiResponse<{ user: StoreUser; token: string }>
        >('/api/auth/login', {
          method: 'POST',
          body: loginData,
        })

        if (response.success) {
          this.user = response.data.user
          this.isAuthenticated = true

          // Store token in localStorage
          if (process.client) {
            localStorage.setItem('authToken', response.data.token)
          }

          return true
        } else {
          this.error = response.message || 'Login failed'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Login failed'
        console.error('Error during login:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    async register(registerData: RegisterData) {
      this.loading = true
      this.error = null

      try {
        const response = await $fetch<
          ApiResponse<{ user: StoreUser; token: string }>
        >('/api/auth/register', {
          method: 'POST',
          body: registerData,
        })

        if (response.success) {
          this.user = response.data.user
          this.isAuthenticated = true

          // Store token in localStorage
          if (process.client) {
            localStorage.setItem('authToken', response.data.token)
          }

          return true
        } else {
          this.error = response.message || 'Registration failed'
          return false
        }
      } catch (error: any) {
        this.error = error.message || 'Registration failed'
        console.error('Error during registration:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    async logout() {
      this.loading = true

      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch (error) {
        console.error('Error during logout:', error)
      } finally {
        // Clear local state regardless of API response
        this.user = null
        this.isAuthenticated = false
        this.loading = false

        // Remove token from localStorage
        if (process.client) {
          localStorage.removeItem('authToken')
        }
      }
    },

    clearError() {
      this.error = null
    },

    setUser(user: StoreUser) {
      this.user = user
      this.isAuthenticated = true
    },

    // Initialize auth state from localStorage
    async initializeAuth() {
      if (process.client) {
        const token = localStorage.getItem('authToken')
        if (token) {
          await this.fetchUser()
        }
      }
    },
  },
})
