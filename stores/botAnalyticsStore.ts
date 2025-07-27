import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface BotStats {
  totalBots: number
  activeBots: number
  inactiveBots: number
  totalInteractions: number
  averageResponseTime: number
  successRate: number
}

interface PerformanceTrend {
  date: string
  interactions: number
  responseTime: number
  successRate: number
}

interface BotActivity {
  id: string
  botId: string
  botName: string
  action: string
  timestamp: string
  status: 'success' | 'error' | 'pending'
  details?: string
}

export const useBotAnalyticsStore = defineStore('botAnalytics', () => {
  // State
  const botStats = ref<BotStats>({
    totalBots: 0,
    activeBots: 0,
    inactiveBots: 0,
    totalInteractions: 0,
    averageResponseTime: 0,
    successRate: 0,
  })

  const performanceTrends = ref<PerformanceTrend[]>([])
  const recentActivity = ref<BotActivity[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const activeBotPercentage = computed(() => {
    if (botStats.value.totalBots === 0) return 0
    return Math.round(
      (botStats.value.activeBots / botStats.value.totalBots) * 100
    )
  })

  const averageInteractionsPerBot = computed(() => {
    if (botStats.value.totalBots === 0) return 0
    return Math.round(
      botStats.value.totalInteractions / botStats.value.totalBots
    )
  })

  const recentActivityCount = computed(() => recentActivity.value.length)

  // Actions
  const fetchBotStats = async () => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch('/api/bots/analytics/stats')
      botStats.value = response as BotStats
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch bot statistics'
      console.error('Error fetching bot stats:', err)
    } finally {
      isLoading.value = false
    }
  }

  const fetchPerformanceTrends = async (days: number = 30) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch(`/api/bots/analytics/trends?days=${days}`)
      performanceTrends.value = response as PerformanceTrend[]
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch performance trends'
      console.error('Error fetching performance trends:', err)
    } finally {
      isLoading.value = false
    }
  }

  const fetchRecentActivity = async (limit: number = 10) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch(
        `/api/bots/analytics/activity?limit=${limit}`
      )
      recentActivity.value = response as BotActivity[]
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch recent activity'
      console.error('Error fetching recent activity:', err)
    } finally {
      isLoading.value = false
    }
  }

  const getBotPerformance = async (botId: string) => {
    try {
      const response = await $fetch(`/api/bots/${botId}/analytics/performance`)
      return response
    } catch (err: any) {
      console.error('Error fetching bot performance:', err)
      throw err
    }
  }

  const getBotInteractions = async (botId: string, limit: number = 50) => {
    try {
      const response = await $fetch(
        `/api/bots/${botId}/analytics/interactions?limit=${limit}`
      )
      return response
    } catch (err: any) {
      console.error('Error fetching bot interactions:', err)
      throw err
    }
  }

  const refreshAnalytics = async () => {
    await Promise.all([
      fetchBotStats(),
      fetchPerformanceTrends(),
      fetchRecentActivity(),
    ])
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    botStats,
    performanceTrends,
    recentActivity,
    isLoading,
    error,

    // Computed
    activeBotPercentage,
    averageInteractionsPerBot,
    recentActivityCount,

    // Actions
    fetchBotStats,
    fetchPerformanceTrends,
    fetchRecentActivity,
    getBotPerformance,
    getBotInteractions,
    refreshAnalytics,
    clearError,
  }
})
