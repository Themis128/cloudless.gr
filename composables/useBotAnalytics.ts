import { computed } from 'vue'

// Composable that uses the Pinia store
export const useBotAnalytics = () => {
  const botAnalyticsStore = useBotAnalyticsStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    botStats: computed(() => botAnalyticsStore.botStats),
    performanceTrends: computed(() => botAnalyticsStore.performanceTrends),
    recentActivity: computed(() => botAnalyticsStore.recentActivity),
    isLoading: computed(() => botAnalyticsStore.isLoading),
    error: computed(() => botAnalyticsStore.error),

    // Computed properties from store
    activeBotPercentage: computed(() => botAnalyticsStore.activeBotPercentage),
    averageInteractionsPerBot: computed(() => botAnalyticsStore.averageInteractionsPerBot),
    recentActivityCount: computed(() => botAnalyticsStore.recentActivityCount),

    // Methods (delegate to store)
    fetchBotStats: botAnalyticsStore.fetchBotStats,
    fetchPerformanceTrends: botAnalyticsStore.fetchPerformanceTrends,
    fetchRecentActivity: botAnalyticsStore.fetchRecentActivity,
    getBotPerformance: botAnalyticsStore.getBotPerformance,
    getBotInteractions: botAnalyticsStore.getBotInteractions,
    refreshAnalytics: botAnalyticsStore.refreshAnalytics,
    clearError: botAnalyticsStore.clearError,

    // Legacy computed properties for backward compatibility
    botPerformance: computed(() => {
      // This would need to be implemented based on the store's data
      return []
    }),

    statusDistribution: computed(() => {
      const stats = botAnalyticsStore.botStats
      return {
        active: stats.activeBots,
        inactive: stats.inactiveBots,
        training: stats.totalBots - stats.activeBots - stats.inactiveBots
      }
    }),

    // Legacy methods for backward compatibility
    exportAnalytics: () => {
      const analyticsData = {
        timestamp: new Date().toISOString(),
        stats: botAnalyticsStore.botStats,
        performance: botAnalyticsStore.performanceTrends,
        recentActivity: botAnalyticsStore.recentActivity,
      }

      const blob = new Blob([JSON.stringify(analyticsData, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bot-analytics-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },

    generateReport: () => {
      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalBots: botAnalyticsStore.botStats.totalBots,
          activeBots: botAnalyticsStore.botStats.activeBots,
          totalInteractions: botAnalyticsStore.botStats.totalInteractions,
          averageResponseTime: botAnalyticsStore.botStats.averageResponseTime,
          successRate: botAnalyticsStore.botStats.successRate,
        },
        trends: botAnalyticsStore.performanceTrends,
        recentActivity: botAnalyticsStore.recentActivity,
      }

      return report
    }
  }
}
