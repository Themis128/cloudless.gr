import { computed } from 'vue'
import { useDashboardStore } from '~/stores/dashboardStore'

// Composable that uses the Pinia store
export const useDashboard = () => {
  const dashboardStore = useDashboardStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    isLoading: computed(() => dashboardStore.loading),
    error: computed(() => dashboardStore.error),
    stats: computed(() => dashboardStore.stats),

    // Computed properties from store
    actionCards: computed(() => dashboardStore.actionCards),
    metricCards: computed(() => dashboardStore.metricCards),
    recentActivity: computed(() => dashboardStore.recentActivity),
    quickStats: computed(() => dashboardStore.quickStats),
    systemStatus: computed(() => dashboardStore.systemStatus),

    // Methods (delegate to store)
    fetchDashboardData: dashboardStore.fetchDashboardData,
    refreshDashboardData: dashboardStore.refreshDashboardData,
    updateActionCardLoading: dashboardStore.updateActionCardLoading,
    addActionCard: dashboardStore.addActionCard,
    removeActionCard: dashboardStore.removeActionCard,
    updateActionCard: dashboardStore.updateActionCard,
    clearError: dashboardStore.clearError,
    createActionCard: dashboardStore.createActionCard,

    // Legacy computed properties for backward compatibility
    recentProjects: computed(() => {
      // This would need to be implemented based on the store's data
      return []
    }),

    // Legacy methods for backward compatibility
    fetchAllData: async () => {
      return await dashboardStore.fetchDashboardData()
    },

    refreshData: async () => {
      return await dashboardStore.refreshDashboardData()
    },
  }
}
