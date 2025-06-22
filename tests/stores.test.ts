import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Nuxt dependencies
const mockNavigateTo = vi.fn()
const mockUseSupabaseClient = vi.fn()
const mockUseSupabaseUser = vi.fn()
const mockUseNuxtApp = vi.fn()
const mockUseRuntimeConfig = vi.fn()

// Mock #app module
vi.mock('#app', () => ({
  navigateTo: mockNavigateTo,
  useNuxtApp: mockUseNuxtApp,
  useRuntimeConfig: mockUseRuntimeConfig,
}))

// Mock @nuxt/supabase module
vi.mock('@nuxt/supabase', () => ({
  useSupabaseClient: mockUseSupabaseClient,
  useSupabaseUser: mockUseSupabaseUser,
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  })),
}

// Set up default mocks
mockUseSupabaseClient.mockReturnValue(mockSupabaseClient)
mockUseSupabaseUser.mockReturnValue({ value: null })
mockUseNuxtApp.mockReturnValue({ $toast: { success: vi.fn(), error: vi.fn() } })
mockUseRuntimeConfig.mockReturnValue({ public: {} })

import { useAdminStore } from '~/stores/adminStore'
import { useAuthStore } from '~/stores/authStore'
import { useUserStore } from '~/stores/userStore'

describe('Pinia Stores Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('AuthStore', () => {
    it('should initialize with correct default state', () => {
      const authStore = useAuthStore()
      
      expect(authStore.user).toBeNull()
      expect(authStore.loading).toBe(false)
      expect(authStore.error).toBeNull()
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('should have working getters', () => {
      const authStore = useAuthStore()
      
      // Test with no user
      expect(authStore.isAdmin).toBe(false)
      expect(authStore.isActive).toBe(false)
      expect(authStore.isEmailVerified).toBe(false)
      
      // Mock user data
      authStore.user = {
        id: 'test-id',
        email: 'test@example.com',
        role: 'admin',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      expect(authStore.isAdmin).toBe(true)
      expect(authStore.isActive).toBe(true)
      expect(authStore.isEmailVerified).toBe(true)
    })
  })

  describe('UserStore', () => {
    it('should initialize with correct default state', () => {
      const userStore = useUserStore()
      
      expect(userStore.preferences).toBeNull()
      expect(userStore.loading).toBe(false)
      expect(userStore.error).toBeNull()
    })

    it('should have working computed getters', () => {
      const userStore = useUserStore()
      
      expect(userStore.currentTheme).toBe('auto')
    })
  })

  describe('AdminStore', () => {
    it('should initialize with correct default state', () => {
      const adminStore = useAdminStore()
      
      expect(adminStore.users).toEqual([])
      expect(adminStore.stats).toBeNull()
      expect(adminStore.systemHealth).toBeNull()
      expect(adminStore.loading).toBe(false)
      expect(adminStore.error).toBeNull()
    })

    it('should have working getters', () => {
      const adminStore = useAdminStore()
      
      expect(adminStore.totalUsers).toBe(0)
      expect(adminStore.activeUsers).toBe(0)
      expect(adminStore.lockedUsers).toBe(0)
    })

    it('should filter users correctly with search', () => {
      const adminStore = useAdminStore()
        // Mock some users
      adminStore.users = [
        {
          id: '1',
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Doe',
          full_name: 'John Doe',
          username: 'johndoe',
          avatar_url: null,
          website: null,
          bio: null,
          role: 'user',
          is_active: true,
          email_verified: true,
          failed_login_attempts: 0,
          locked_until: null,
          last_login: null,
          reset_token: null,
          reset_token_expires: null,
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        },
        {
          id: '2', 
          email: 'admin@example.com',
          first_name: 'Admin',
          last_name: 'User',
          full_name: 'Admin User',
          username: 'admin',
          avatar_url: null,
          website: null,
          bio: null,
          role: 'admin',
          is_active: true,
          email_verified: true,
          failed_login_attempts: 0,
          locked_until: null,
          last_login: null,
          reset_token: null,
          reset_token_expires: null,
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        }
      ]
      
      expect(adminStore.searchUsers('john')).toHaveLength(1)
      expect(adminStore.searchUsers('admin')).toHaveLength(1)
      expect(adminStore.searchUsers('example')).toHaveLength(2)
      expect(adminStore.searchUsers('nonexistent')).toHaveLength(0)
    })
  })

  describe('Store Integration', () => {
    it('should work together correctly', () => {
      const authStore = useAuthStore()
      const userStore = useUserStore()
      const adminStore = useAdminStore()
      
      // Mock authenticated admin user
      authStore.user = {
        id: 'admin-id',
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        email_verified: true,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      authStore.isAuthenticated = true
      
      // UserStore should get data from AuthStore
      expect(userStore.profile).toEqual(authStore.user)
      expect(userStore.fullName).toBe('Admin User')
      expect(userStore.isAdmin()).toBe(true)
      
      // AdminStore should recognize admin status
      expect(adminStore.isAdmin).toBe(true)
    })
  })
})
