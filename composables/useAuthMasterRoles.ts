import { useSupabaseClient, useSupabaseUser } from '#imports'
import { computed } from 'vue'
/**
 * Auth-Master Role Management Composable
 * Manages roles using only Supabase auth-master (no separate profiles table)
 */

export interface AuthMasterUser {
  id: string
  email: string
  role: 'user' | 'admin' | 'moderator'
  is_active: boolean
  permissions: string[]
}

export function useAuthMasterRoles() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  /**
   * Get user role from auth-master metadata
   */
  const getUserRole = (): AuthMasterUser | null => {
    if (!user.value) return null

    const role = user.value.user_metadata?.role || user.value.app_metadata?.role || 'user'
    const isActive = user.value.app_metadata?.is_active !== false
    
    return {
      id: user.value.id,
      email: user.value.email || '',
      role: role as 'user' | 'admin' | 'moderator',
      is_active: isActive,
      permissions: getPermissionsForRole(role)
    }
  }

  /**
   * Set user role in auth-master metadata (admin only)
   */
  const setUserRole = async (userId: string, role: 'user' | 'admin' | 'moderator'): Promise<void> => {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { role }
      })
      
      if (error) throw error
    } catch (error) {
      console.error('Failed to set user role:', error)
      throw error
    }
  }

  /**
   * Set user active status in auth-master metadata (admin only)
   */
  const setUserActiveStatus = async (userId: string, isActive: boolean): Promise<void> => {
    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { is_active: isActive }
      })
      
      if (error) throw error
    } catch (error) {
      console.error('Failed to set user active status:', error)
      throw error
    }
  }

  /**
   * Create user with role (during registration)
   */
  const createUserWithRole = async (
    email: string, 
    password: string, 
    role: 'user' | 'admin' | 'moderator' = 'user',
    userData?: Record<string, unknown>
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...userData,
            role
          }
        }
      })
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to create user with role:', error)
      throw error
    }
  }

  /**
   * Check if current user has specific permission
   */
  const hasPermission = (permission: string): boolean => {
    const userRole = getUserRole()
    return userRole?.permissions.includes(permission) ?? false
  }

  /**
   * Check if current user has specific role
   */
  const hasRole = (role: 'user' | 'admin' | 'moderator'): boolean => {
    const userRole = getUserRole()
    return userRole?.role === role
  }

  /**
   * Get permissions for a role
   */
  function getPermissionsForRole(role: string): string[] {
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

    return permissions[role as keyof typeof permissions] || []
  }

  // Reactive computed properties
  const currentUser = computed(() => getUserRole())
  const isAdmin = computed(() => hasRole('admin'))
  const isModerator = computed(() => hasRole('moderator'))
  const isUser = computed(() => hasRole('user'))
  const isAuthenticated = computed(() => !!user.value)

  return {
    // State
    currentUser,
    isAuthenticated,
    isAdmin,
    isModerator,
    isUser,
    
    // Methods
    getUserRole,
    setUserRole,
    setUserActiveStatus,
    createUserWithRole,
    hasPermission,
    hasRole,
    getPermissionsForRole
  }
}
