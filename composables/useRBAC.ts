import { computed } from 'vue'
import type { User } from '~/types/common'

// Composable that uses the Pinia store
export const useRBAC = () => {
  const rbacStore = useRBACStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    user: computed(() => rbacStore.user),
    permissions: computed(() => rbacStore.permissions),
    roles: computed(() => rbacStore.roles),
    isLoading: computed(() => rbacStore.isLoading),
    error: computed(() => rbacStore.error),

    // Computed properties
    isAdmin: computed(() => rbacStore.isAdmin),
    isDeveloper: computed(() => rbacStore.isDeveloper),
    isUser: computed(() => rbacStore.isUser),
    canManageUsers: computed(() => rbacStore.canManageUsers),
    canManageRoles: computed(() => rbacStore.canManageRoles),
    canManageBots: computed(() => rbacStore.canManageBots),
    canCreateBots: computed(() => rbacStore.canCreateBots),
    canEditBots: computed(() => rbacStore.canEditBots),
    canDeleteBots: computed(() => rbacStore.canDeleteBots),
    canDeployBots: computed(() => rbacStore.canDeployBots),
    canManageModels: computed(() => rbacStore.canManageModels),
    canCreateModels: computed(() => rbacStore.canCreateModels),
    canEditModels: computed(() => rbacStore.canEditModels),
    canDeleteModels: computed(() => rbacStore.canDeleteModels),
    canTrainModels: computed(() => rbacStore.canTrainModels),
    canManagePipelines: computed(() => rbacStore.canManagePipelines),
    canCreatePipelines: computed(() => rbacStore.canCreatePipelines),
    canEditPipelines: computed(() => rbacStore.canEditPipelines),
    canDeletePipelines: computed(() => rbacStore.canDeletePipelines),
    canExecutePipelines: computed(() => rbacStore.canExecutePipelines),
    canAccessAnalytics: computed(() => rbacStore.canAccessAnalytics),
    canManageDatasets: computed(() => rbacStore.canManageDatasets),
    canCreateDatasets: computed(() => rbacStore.canCreateDatasets),
    canEditDatasets: computed(() => rbacStore.canEditDatasets),
    canDeleteDatasets: computed(() => rbacStore.canDeleteDatasets),

    // Methods (delegate to store)
    checkPermission: rbacStore.checkPermission,
    hasPermission: rbacStore.hasPermission,
    hasAnyPermission: rbacStore.hasAnyPermission,
    hasAllPermissions: rbacStore.hasAllPermissions,
    hasRole: rbacStore.hasRole,
    canAccessRoute: rbacStore.canAccessRoute,
    setUser: rbacStore.setUser,
    setPermissions: rbacStore.setPermissions,
    setRoles: rbacStore.setRoles,
    setLoading: rbacStore.setLoading,
    setError: rbacStore.setError,
    fetchPermissions: rbacStore.fetchPermissions,
    fetchRoles: rbacStore.fetchRoles,
    initializeRBAC: rbacStore.initializeRBAC,
    clearRBAC: rbacStore.clearRBAC,
  }
}
