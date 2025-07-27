import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

interface UserRole {
  id: number
  role: {
    id: number
    name: string
    description: string
  }
  assignedAt: string
  expiresAt?: string
  isActive: boolean
}

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  userRoles?: UserRole[]
}

export const useRBACStore = defineStore('rbac', () => {
  // State
  const user = ref<User | null>(null)
  const permissions = ref<Permission[]>([])
  const roles = ref<Role[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties for role-based access
  const isAdmin = computed(() => {
    if (!user.value) return false
    return (
      user.value.role === 'admin' ||
      user.value.userRoles?.some(ur => ur.role.name === 'admin' && ur.isActive)
    )
  })

  const isDeveloper = computed(() => {
    if (!user.value) return false
    return (
      user.value.role === 'developer' ||
      user.value.userRoles?.some(ur => ur.role.name === 'developer' && ur.isActive)
    )
  })

  const isUser = computed(() => {
    if (!user.value) return false
    return (
      user.value.role === 'user' ||
      user.value.userRoles?.some(ur => ur.role.name === 'user' && ur.isActive)
    )
  })

  // Helper function to check permissions
  const checkPermission = (resource: string, action: string) => {
    // For now, admin users have all permissions
    if (isAdmin.value) return true
    
    return permissions.value.some(p => p.resource === resource && p.action === action)
  }

  // Permission-based access control
  const canManageUsers = computed(() => {
    return checkPermission('admin', 'users') || isAdmin.value
  })

  const canManageRoles = computed(() => {
    return checkPermission('admin', 'roles') || isAdmin.value
  })

  const canManageBots = computed(() => {
    return checkPermission('bot', 'all') || isAdmin.value
  })

  const canCreateBots = computed(() => {
    return checkPermission('bot', 'create') || canManageBots.value
  })

  const canEditBots = computed(() => {
    return checkPermission('bot', 'update') || canManageBots.value
  })

  const canDeleteBots = computed(() => {
    return checkPermission('bot', 'delete') || canManageBots.value
  })

  const canDeployBots = computed(() => {
    return checkPermission('bot', 'deploy') || canManageBots.value
  })

  const canManageModels = computed(() => {
    return checkPermission('model', 'all') || isAdmin.value
  })

  const canCreateModels = computed(() => {
    return checkPermission('model', 'create') || canManageModels.value
  })

  const canEditModels = computed(() => {
    return checkPermission('model', 'update') || canManageModels.value
  })

  const canDeleteModels = computed(() => {
    return checkPermission('model', 'delete') || canManageModels.value
  })

  const canTrainModels = computed(() => {
    return checkPermission('model', 'train') || canManageModels.value
  })

  const canManagePipelines = computed(() => {
    return checkPermission('pipeline', 'all') || isAdmin.value
  })

  const canCreatePipelines = computed(() => {
    return checkPermission('pipeline', 'create') || canManagePipelines.value
  })

  const canEditPipelines = computed(() => {
    return checkPermission('pipeline', 'update') || canManagePipelines.value
  })

  const canDeletePipelines = computed(() => {
    return checkPermission('pipeline', 'delete') || canManagePipelines.value
  })

  const canExecutePipelines = computed(() => {
    return checkPermission('pipeline', 'execute') || canManagePipelines.value
  })

  const canAccessAnalytics = computed(() => {
    return checkPermission('admin', 'analytics') || isAdmin.value
  })

  const canManageDatasets = computed(() => {
    return checkPermission('dataset', 'all') || isAdmin.value
  })

  const canCreateDatasets = computed(() => {
    return checkPermission('dataset', 'create') || canManageDatasets.value
  })

  const canEditDatasets = computed(() => {
    return checkPermission('dataset', 'update') || canManageDatasets.value
  })

  const canDeleteDatasets = computed(() => {
    return checkPermission('dataset', 'delete') || canManageDatasets.value
  })

  // Permission checking methods
  const hasPermission = (resource: string, action: string) => {
    return checkPermission(resource, action)
  }

  const hasAnyPermission = (
    permissions: Array<{ resource: string; action: string }>
  ) => {
    return permissions.some(({ resource, action }) => 
      checkPermission(resource, action)
    )
  }

  const hasAllPermissions = (
    permissions: Array<{ resource: string; action: string }>
  ) => {
    return permissions.every(({ resource, action }) => 
      checkPermission(resource, action)
    )
  }

  // Role checking methods
  const hasRole = (roleNames: string | string[]) => {
    if (!user.value) return false
    
    const rolesToCheck = Array.isArray(roleNames) ? roleNames : [roleNames]
    
    return rolesToCheck.some(roleName => {
      // Check primary role
      if (user.value?.role === roleName) return true
      
      // Check user roles
      return user.value?.userRoles?.some(ur => 
        ur.role.name === roleName && ur.isActive
      ) || false
    })
  }

  // Route access control
  const canAccessRoute = (route: string) => {
    // Admin can access everything
    if (isAdmin.value) return true

    // Route-based permissions
    const routePermissions: Record<string, Array<{ resource: string; action: string }>> = {
      '/admin': [{ resource: 'admin', action: 'access' }],
      '/admin/users': [{ resource: 'admin', action: 'users' }],
      '/admin/roles': [{ resource: 'admin', action: 'roles' }],
      '/admin/analytics': [{ resource: 'admin', action: 'analytics' }],
      '/bots': [{ resource: 'bot', action: 'read' }],
      '/bots/create': [{ resource: 'bot', action: 'create' }],
      '/models': [{ resource: 'model', action: 'read' }],
      '/models/create': [{ resource: 'model', action: 'create' }],
      '/pipelines': [{ resource: 'pipeline', action: 'read' }],
      '/pipelines/create': [{ resource: 'pipeline', action: 'create' }],
      '/datasets': [{ resource: 'dataset', action: 'read' }],
      '/datasets/create': [{ resource: 'dataset', action: 'create' }],
    }

    const requiredPermissions = routePermissions[route]
    if (!requiredPermissions) return true // Default allow if no specific permissions defined

    return hasAnyPermission(requiredPermissions)
  }

  // Actions
  const setUser = (newUser: User | null) => {
    user.value = newUser
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

  const fetchPermissions = async () => {
    if (!user.value) return

    try {
      setLoading(true)
      setError(null)

      const response = await $fetch('/api/auth/permissions') as any

      if (response.success) {
        setPermissions(response.permissions || [])
      }
    } catch (err: any) {
      console.error('Error fetching permissions:', err)
      setError(err.message || 'Failed to fetch permissions')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    if (!user.value) return

    try {
      setLoading(true)
      setError(null)

      const response = await $fetch('/api/auth/roles') as any

      if (response.success) {
        setRoles(response.roles || [])
      }
    } catch (err: any) {
      console.error('Error fetching roles:', err)
      setError(err.message || 'Failed to fetch roles')
    } finally {
      setLoading(false)
    }
  }

  const initializeRBAC = (authUser: User | null) => {
    setUser(authUser)
    if (authUser) {
      fetchPermissions()
      fetchRoles()
    }
  }

  const clearRBAC = () => {
    setUser(null)
    setPermissions([])
    setRoles([])
    setError(null)
  }

  return {
    // State
    user,
    permissions,
    roles,
    isLoading,
    error,
    
    // Computed
    isAdmin,
    isDeveloper,
    isUser,
    canManageUsers,
    canManageRoles,
    canManageBots,
    canCreateBots,
    canEditBots,
    canDeleteBots,
    canDeployBots,
    canManageModels,
    canCreateModels,
    canEditModels,
    canDeleteModels,
    canTrainModels,
    canManagePipelines,
    canCreatePipelines,
    canEditPipelines,
    canDeletePipelines,
    canExecutePipelines,
    canAccessAnalytics,
    canManageDatasets,
    canCreateDatasets,
    canEditDatasets,
    canDeleteDatasets,
    
    // Methods
    checkPermission,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccessRoute,
    setUser,
    setPermissions,
    setRoles,
    setLoading,
    setError,
    fetchPermissions,
    fetchRoles,
    initializeRBAC,
    clearRBAC
  }
}) 