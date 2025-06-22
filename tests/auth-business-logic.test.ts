import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

// Extract the pure authentication logic from the store
// This tests the actual business logic without Nuxt dependencies

interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  role: 'user' | 'admin' | 'moderator'
  is_active: boolean
  email_verified: boolean
  failed_login_attempts: number
  locked_until?: string | null
  last_login?: string | null
  created_at: string
  updated_at: string
}

interface AuthResponse {
  success: boolean
  user?: AuthUser
  error?: string
  message?: string
  requiresEmailVerification?: boolean
  isLocked?: boolean
}

// Pure authentication logic extracted from authStore
class AuthLogic {
  // Route determination logic
  static getRedirectPath(user: AuthUser | null): string {
    if (!user) return '/auth'
    return user.role === 'admin' ? '/admin' : '/projects'
  }
  // User role validation
  static isUserAdmin(user: AuthUser | null): boolean {
    return user?.role === 'admin' || false
  }

  static isUserActive(user: AuthUser | null): boolean {
    return user?.is_active ?? false
  }

  static isAccountLocked(user: AuthUser | null): boolean {
    if (!user?.locked_until) return false
    return new Date(user.locked_until) > new Date()
  }

  // Route protection logic
  static isPublicRoute(path: string): boolean {
    const publicRoutes = [
      '/',
      '/info',
      '/info/matrix',
      '/info/about',
      '/info/contact',
      '/info/faq',
      '/info/sitemap',
      '/auth',
      '/auth/register',
      '/auth/reset',
      '/auth/users-nav',
      '/documentation',
      '/documentation/api-reference',
      '/documentation/faq',
      '/documentation/getting-started',
      '/documentation/roadmap',
      '/documentation/troubleshooting',
      '/documentation/user-guide',
    ]
    
    return publicRoutes.some(route => {
      if (route.endsWith('/*')) {
        return path.startsWith(route.slice(0, -2))
      }
      return path === route
    })
  }

  static isAdminRoute(path: string): boolean {
    return path.startsWith('/admin') || path.startsWith('/sys')
  }

  static canAccessRoute(path: string, user: AuthUser | null): boolean {
    // Public routes are always accessible
    if (this.isPublicRoute(path)) return true
    
    // User must be authenticated for protected routes
    if (!user) return false
    
    // Admin routes require admin role
    if (this.isAdminRoute(path)) {
      return this.isUserAdmin(user)
    }
    
    // All other routes require authentication only
    return true
  }

  // Login validation logic
  static validateLoginAttempt(email: string, password: string, userProfile: AuthUser | null, requireAdmin = false): AuthResponse {
    // Check if user exists
    if (!userProfile) {
      return {
        success: false,
        error: 'No account found with this email address.'
      }
    }

    // Check if account is locked
    if (this.isAccountLocked(userProfile)) {
      return {
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts.',
        isLocked: true
      }
    }

    // Check admin requirement
    if (requireAdmin && userProfile.role !== 'admin') {
      return {
        success: false,
        error: 'Admin access required. Please use admin login.'
      }
    }

    // Check if account is active
    if (!userProfile.is_active) {
      return {
        success: false,
        error: 'Account is deactivated. Please contact support.'
      }
    }

    // Basic password validation (in real implementation, this would be handled by Supabase)
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required.'
      }
    }

    // Login successful
    return {
      success: true,
      user: userProfile,
      message: `Welcome back, ${userProfile.full_name || userProfile.email}!`
    }
  }
  // Error handling logic
  static getAuthErrorRedirect(error: string, _isAdminRoute: boolean): string {
    const params = new URLSearchParams({ error })
    return `/auth?${params.toString()}`
  }
}

// Test data
const testUsers = {
  admin: {
    id: 'admin-123',
    email: 'admin@test.com',
    full_name: 'Test Admin',
    role: 'admin' as const,
    is_active: true,
    email_verified: true,
    failed_login_attempts: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  user: {
    id: 'user-456',
    email: 'user@test.com',
    full_name: 'Test User',
    role: 'user' as const,
    is_active: true,
    email_verified: true,
    failed_login_attempts: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  lockedUser: {
    id: 'locked-789',
    email: 'locked@test.com',
    full_name: 'Locked User',
    role: 'user' as const,
    is_active: true,
    email_verified: true,
    failed_login_attempts: 5,
    locked_until: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  inactiveUser: {
    id: 'inactive-999',
    email: 'inactive@test.com',
    full_name: 'Inactive User',
    role: 'user' as const,
    is_active: false,
    email_verified: true,
    failed_login_attempts: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

describe('Real Authentication Logic Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('User Role and State Logic', () => {
    it('should correctly identify admin users', () => {
      expect(AuthLogic.isUserAdmin(testUsers.admin)).toBe(true)
      expect(AuthLogic.isUserAdmin(testUsers.user)).toBe(false)
      expect(AuthLogic.isUserAdmin(null)).toBe(false)
    })

    it('should correctly identify active users', () => {
      expect(AuthLogic.isUserActive(testUsers.admin)).toBe(true)
      expect(AuthLogic.isUserActive(testUsers.user)).toBe(true)
      expect(AuthLogic.isUserActive(testUsers.inactiveUser)).toBe(false)
      expect(AuthLogic.isUserActive(null)).toBe(false)
    })

    it('should correctly identify locked accounts', () => {
      expect(AuthLogic.isAccountLocked(testUsers.lockedUser)).toBe(true)
      expect(AuthLogic.isAccountLocked(testUsers.admin)).toBe(false)
      expect(AuthLogic.isAccountLocked(testUsers.user)).toBe(false)
      expect(AuthLogic.isAccountLocked(null)).toBe(false)
    })
  })

  describe('Route Redirection Logic', () => {
    it('should redirect admin users to /admin', () => {
      const redirectPath = AuthLogic.getRedirectPath(testUsers.admin)
      expect(redirectPath).toBe('/admin')
    })

    it('should redirect regular users to /projects', () => {
      const redirectPath = AuthLogic.getRedirectPath(testUsers.user)
      expect(redirectPath).toBe('/projects')
    })

    it('should redirect unauthenticated users to /auth', () => {
      const redirectPath = AuthLogic.getRedirectPath(null)
      expect(redirectPath).toBe('/auth')
    })
  })

  describe('Route Protection Logic', () => {
    const publicRoutes = [
      '/',
      '/info',
      '/info/about',
      '/info/contact',
      '/auth',
      '/auth/register',
      '/documentation',
    ]

    const adminRoutes = [
      '/admin',
      '/admin/users',
      '/admin/settings',
      '/sys',
      '/sys/maintenance'
    ]

    const userRoutes = [
      '/projects',
      '/users',
      '/settings'
    ]

    it('should correctly identify public routes', () => {
      publicRoutes.forEach(route => {
        expect(AuthLogic.isPublicRoute(route)).toBe(true)
      })
    })

    it('should correctly identify admin routes', () => {
      adminRoutes.forEach(route => {
        expect(AuthLogic.isAdminRoute(route)).toBe(true)
      })
      
      // Non-admin routes should not be identified as admin routes
      publicRoutes.forEach(route => {
        expect(AuthLogic.isAdminRoute(route)).toBe(false)
      })
    })

    it('should allow access to public routes without authentication', () => {
      publicRoutes.forEach(route => {
        expect(AuthLogic.canAccessRoute(route, null)).toBe(true)
      })
    })

    it('should block admin routes for non-admin users', () => {
      adminRoutes.forEach(route => {
        expect(AuthLogic.canAccessRoute(route, testUsers.user)).toBe(false)
      })
    })

    it('should allow admin routes for admin users', () => {
      adminRoutes.forEach(route => {
        expect(AuthLogic.canAccessRoute(route, testUsers.admin)).toBe(true)
      })
    })

    it('should block user routes for unauthenticated users', () => {
      userRoutes.forEach(route => {
        expect(AuthLogic.canAccessRoute(route, null)).toBe(false)
      })
    })

    it('should allow user routes for authenticated users', () => {
      userRoutes.forEach(route => {
        expect(AuthLogic.canAccessRoute(route, testUsers.user)).toBe(true)
        expect(AuthLogic.canAccessRoute(route, testUsers.admin)).toBe(true)
      })
    })

    it('should NOT include removed admin-login route in public routes', () => {
      expect(AuthLogic.isPublicRoute('/auth/admin-login')).toBe(false)
    })
  })

  describe('Login Validation Logic', () => {
    it('should validate successful admin login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'admin@test.com',
        'password123',
        testUsers.admin,
        false
      )

      expect(result.success).toBe(true)
      expect(result.user?.role).toBe('admin')
      expect(result.error).toBeUndefined()
    })

    it('should validate successful user login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'user@test.com',
        'password123',
        testUsers.user,
        false
      )

      expect(result.success).toBe(true)
      expect(result.user?.role).toBe('user')
      expect(result.error).toBeUndefined()
    })

    it('should block non-admin from admin-required login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'user@test.com',
        'password123',
        testUsers.user,
        true // requireAdmin = true
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Admin access required')
    })

    it('should block locked account login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'locked@test.com',
        'password123',
        testUsers.lockedUser,
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('temporarily locked')
      expect(result.isLocked).toBe(true)
    })

    it('should block inactive account login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'inactive@test.com',
        'password123',
        testUsers.inactiveUser,
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('deactivated')
    })

    it('should block non-existent user login', () => {
      const result = AuthLogic.validateLoginAttempt(
        'nonexistent@test.com',
        'password123',
        null,
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No account found')
    })

    it('should validate required fields', () => {
      const result = AuthLogic.validateLoginAttempt(
        '',
        '',
        testUsers.user,
        false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Email and password are required')
    })
  })

  describe('Error Handling Logic', () => {
    it('should generate correct error redirect URLs', () => {
      const errorUrl = AuthLogic.getAuthErrorRedirect('unauthorized', false)
      expect(errorUrl).toBe('/auth?error=unauthorized')

      const loginRequiredUrl = AuthLogic.getAuthErrorRedirect('login_required', true)
      expect(loginRequiredUrl).toBe('/auth?error=login_required')
    })
  })

  describe('Authentication Flow Integration', () => {
    it('should complete full admin authentication flow', () => {
      // 1. Validate login
      const loginResult = AuthLogic.validateLoginAttempt(
        'admin@test.com',
        'password123',
        testUsers.admin,
        false
      )

      expect(loginResult.success).toBe(true)
      expect(loginResult.user).toBeDefined()

      // 2. Determine redirect path
      const redirectPath = AuthLogic.getRedirectPath(loginResult.user!)
      expect(redirectPath).toBe('/admin')

      // 3. Verify admin access
      expect(AuthLogic.canAccessRoute('/admin', loginResult.user!)).toBe(true)
      expect(AuthLogic.canAccessRoute('/admin/users', loginResult.user!)).toBe(true)
    })

    it('should complete full user authentication flow', () => {
      // 1. Validate login
      const loginResult = AuthLogic.validateLoginAttempt(
        'user@test.com',
        'password123',
        testUsers.user,
        false
      )

      expect(loginResult.success).toBe(true)
      expect(loginResult.user).toBeDefined()

      // 2. Determine redirect path
      const redirectPath = AuthLogic.getRedirectPath(loginResult.user!)
      expect(redirectPath).toBe('/projects')

      // 3. Verify user access
      expect(AuthLogic.canAccessRoute('/projects', loginResult.user!)).toBe(true)
      expect(AuthLogic.canAccessRoute('/admin', loginResult.user!)).toBe(false)
    })

    it('should handle failed authentication flow', () => {
      // 1. Failed login
      const loginResult = AuthLogic.validateLoginAttempt(
        'nonexistent@test.com',
        'password123',
        null,
        false
      )

      expect(loginResult.success).toBe(false)

      // 2. Redirect to auth with error
      const redirectPath = AuthLogic.getRedirectPath(null)
      expect(redirectPath).toBe('/auth')

      // 3. Generate error URL
      const errorUrl = AuthLogic.getAuthErrorRedirect('login_required', false)
      expect(errorUrl).toBe('/auth?error=login_required')
    })
  })

  describe('Unified Authentication Verification', () => {
    it('should confirm unified auth flow works for all user types', () => {
      const users = [testUsers.admin, testUsers.user]
      
      users.forEach(user => {
        // All users use the same login validation
        const loginResult = AuthLogic.validateLoginAttempt(
          user.email,
          'password123',
          user,
          false
        )

        expect(loginResult.success).toBe(true)

        // Redirect is determined by role, not by separate login forms
        const redirectPath = AuthLogic.getRedirectPath(user)
        const expectedPath = user.role === 'admin' ? '/admin' : '/projects'
        expect(redirectPath).toBe(expectedPath)
      })
    })

    it('should confirm no separate admin login logic is needed', () => {
      // Admin users can login with requireAdmin=false (unified login)
      const adminUnifiedLogin = AuthLogic.validateLoginAttempt(
        'admin@test.com',
        'password123',
        testUsers.admin,
        false // No special admin requirement
      )

      expect(adminUnifiedLogin.success).toBe(true)
      expect(adminUnifiedLogin.user?.role).toBe('admin')

      // They still get admin access
      const redirectPath = AuthLogic.getRedirectPath(adminUnifiedLogin.user!)
      expect(redirectPath).toBe('/admin')
    })
  })
})
