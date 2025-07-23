import { computed } from 'vue'
import { useAuthStore } from '~/stores/authStore'

export const useRBAC = () => {
  const authStore = useAuthStore()

  // Computed properties for role-based access
  const isAdmin = computed(() => {
    return authStore.roles.some(role => role.name === 'admin')
  })

  const isDeveloper = computed(() => {
    return authStore.roles.some(role => role.name === 'developer')
  })

  const isUser = computed(() => {
    return authStore.roles.some(role => role.name === 'user')
  })

  // Helper function to check permissions directly from the store
  const checkPermission = (resource: string, action: string) => {
    return authStore.permissions.some(p => p.resource === resource && p.action === action)
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
    return checkPermission('analytics', 'read') || isAdmin.value
  })

  const canAccessDebug = computed(() => {
    return checkPermission('debug', 'all') || isAdmin.value
  })

  const canAccessAdmin = computed(() => {
    return isAdmin.value || canManageUsers.value || canManageRoles.value
  })

  // Helper function to check specific permissions
  const hasPermission = (resource: string, action: string) => {
    return checkPermission(resource, action)
  }

  const hasAnyPermission = (permissions: Array<{ resource: string; action: string }>) => {
    return permissions.some(({ resource, action }) => checkPermission(resource, action))
  }

  const hasAllPermissions = (permissions: Array<{ resource: string; action: string }>) => {
    return permissions.every(({ resource, action }) => checkPermission(resource, action))
  }

  // Helper function to check if user has any of the specified roles
  const hasRole = (roleNames: string | string[]) => {
    const roles = Array.isArray(roleNames) ? roleNames : [roleNames]
    return authStore.roles.some(role => roles.includes(role.name))
  }

  // Helper function to get user's highest privilege level
  const getPrivilegeLevel = computed(() => {
    if (isAdmin.value) return 'admin'
    if (isDeveloper.value) return 'developer'
    if (isUser.value) return 'user'
    return 'guest'
  })

  // Helper function to check if user can access a specific route
  const canAccessRoute = (route: string) => {
    // Admin routes
    if (route.startsWith('/admin')) {
      return canAccessAdmin.value
    }

    // Debug routes
    if (route.startsWith('/debug')) {
      return canAccessDebug.value
    }

    // Analytics routes
    if (route.includes('/analytics')) {
      return canAccessAnalytics.value
    }

    // Bot management routes
    if (route.startsWith('/bots') && (route.includes('/create') || route.includes('/edit'))) {
      return canManageBots.value
    }

    // Model management routes
    if (route.startsWith('/models') && (route.includes('/create') || route.includes('/edit'))) {
      return canManageModels.value
    }

    // Pipeline management routes
    if (route.startsWith('/pipelines') && (route.includes('/create') || route.includes('/edit'))) {
      return canManagePipelines.value
    }

    // Default to allowing access for authenticated users
    return authStore.isAuthenticated
  }

  return {
    // Role checks
    isAdmin,
    isDeveloper,
    isUser,
    hasRole,
    getPrivilegeLevel,

    // Permission checks
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
    canAccessDebug,
    canAccessAdmin,

    // Helper functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,

    // Access to underlying store
    authStore
  }
} 