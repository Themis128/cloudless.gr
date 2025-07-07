/**
 * Role-based authorization middleware
 * Vue 3 + Nuxt 3 + Vuetify 3 best practices:
 * - Proper TypeScript typing
 * - Reactive state management
 * - Error boundary handling
 * - Performance optimization
 */
import type { RouteLocationNormalized } from 'vue-router'

interface UserRole {
  role: 'user' | 'admin' | 'moderator'
  permissions?: string[]
}

interface AuthUser {
  id: string
  email: string
  role: UserRole['role']
  is_active: boolean
}

// Route permissions mapping
const ROUTE_PERMISSIONS = {
  '/admin': ['admin'],
  '/admin/users': ['admin'],
  '/admin/settings': ['admin'],
  '/projects/create': ['admin', 'moderator'],
  '/projects/manage': ['admin', 'moderator'],
  '/dashboard': ['user', 'admin', 'moderator']
} as const

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  try {
    // Get user from Supabase
    const { user } = useSupabaseUser()
    
    if (!user.value) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    // Get user profile with role information
    const { data: profile, error } = await $fetch<{ data: AuthUser; error?: any }>('/api/auth/profile', {
      headers: useRequestHeaders(['authorization'])
    })

    if (error || !profile) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Unable to verify user permissions'
      })
    }

    // Check if user is active
    if (!profile.is_active) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Account is deactivated'
      })
    }

    // Get required roles for the route
    const requiredRoles = getRequiredRoles(to.path)
    
    if (requiredRoles.length === 0) {
      // No specific role required
      return
    }

    // Check if user has required role
    if (!requiredRoles.includes(profile.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions to access this resource'
      })
    }

    // Store user role in state for component access
    const roleStore = useRoleStore()
    roleStore.setUserRole({
      role: profile.role,
      permissions: getPermissionsForRole(profile.role)
    })

  } catch (error) {
    // Handle errors gracefully
    if (error?.statusCode) {
      throw error
    }
    
    console.error('Role middleware error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'An error occurred while checking permissions'
    })
  }
})

/**
 * Get required roles for a given route path
 */
function getRequiredRoles(path: string): UserRole['role'][] {
  // Check exact matches first
  if (path in ROUTE_PERMISSIONS) {
    return ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS]
  }

  // Check path prefixes
  for (const [routePattern, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(routePattern + '/')) {
      return roles
    }
  }

  return []
}

/**
 * Get permissions array for a given role
 */
function getPermissionsForRole(role: UserRole['role']): string[] {
  const permissions = {
    admin: [
      'users.read',
      'users.write',
      'users.delete',
      'projects.read',
      'projects.write',
      'projects.delete',
      'settings.read',
      'settings.write'
    ],
    moderator: [
      'projects.read',
      'projects.write',
      'users.read'
    ],
    user: [
      'projects.read',
      'profile.read',
      'profile.write'
    ]
  }

  return permissions[role] || []
}

/**
 * Role store for managing user role state
 */
const useRoleStore = defineStore('role', () => {
  const userRole = ref<UserRole | null>(null)
  
  const setUserRole = (role: UserRole) => {
    userRole.value = role
  }
  
  const hasPermission = (permission: string): boolean => {
    return userRole.value?.permissions?.includes(permission) ?? false
  }
  
  const hasRole = (role: UserRole['role']): boolean => {
    return userRole.value?.role === role
  }
  
  const isAdmin = computed(() => hasRole('admin'))
  const isModerator = computed(() => hasRole('moderator'))
  const isUser = computed(() => hasRole('user'))
  
  const clearRole = () => {
    userRole.value = null
  }
  
  return {
    userRole: readonly(userRole),
    setUserRole,
    hasPermission,
    hasRole,
    isAdmin,
    isModerator,
    isUser,
    clearRole
  }
})
