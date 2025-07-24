import type { Bot } from '~/stores/botStore'
import { generateBotStats, getBotPerformance } from '~/utils/botHelpers'

export const useBotAnalytics = () => {
  const botStore = useBotStore()
  const config = useRuntimeConfig()
  
  // Bot performance metrics
  const botPerformance = computed(() => {
    return botStore.bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      ...getBotPerformance(bot)
    }))
  })
  
  // Overall statistics
  const botStats = computed(() => {
    return generateBotStats(botStore.bots)
  })
  
  // Performance trends
  const performanceTrends = computed(() => {
    const trends = botStore.bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      responseTime: bot.config?.responseTime || 0,
      accuracy: bot.config?.accuracy || 0,
      conversations: bot.config?.conversations || 0,
      uptime: bot.config?.uptime || 0
    }))
    
    return {
      averageResponseTime: trends.reduce((sum, bot) => sum + bot.responseTime, 0) / trends.length || 0,
      averageAccuracy: trends.reduce((sum, bot) => sum + bot.accuracy, 0) / trends.length || 0,
      totalConversations: trends.reduce((sum, bot) => sum + bot.conversations, 0),
      averageUptime: trends.reduce((sum, bot) => sum + bot.uptime, 0) / trends.length || 0
    }
  })
  
  // Status distribution
  const statusDistribution = computed(() => {
    const distribution = {
      active: 0,
      inactive: 0,
      training: 0
    }
    
    botStore.bots.forEach(bot => {
      distribution[bot.status as keyof typeof distribution]++
    })
    
    return distribution
  })
  
  // Recent activity (last 7 days)
  const recentActivity = computed(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    return botStore.bots
      .filter(bot => new Date(bot.updatedAt) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
  })
  
  // Export analytics data
  const exportAnalytics = () => {
    const analyticsData = {
      timestamp: new Date().toISOString(),
      stats: botStats.value,
      performance: performanceTrends.value,
      statusDistribution: statusDistribution.value,
      recentActivity: recentActivity.value,
      bots: botStore.bots
    }
    
    const blob = new Blob([JSON.stringify(analyticsData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-analytics-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  // Generate performance report
  const generateReport = () => {
    const report = {
      summary: {
        totalBots: botStats.value.total,
        activeBots: botStats.value.active,
        activePercentage: botStats.value.activePercentage,
        averageResponseTime: performanceTrends.value.averageResponseTime,
        averageAccuracy: performanceTrends.value.averageAccuracy
      },
      topPerformers: botPerformance.value
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 5),
      needsAttention: botStore.bots
        .filter(bot => bot.status === 'inactive' || (bot.config?.accuracy || 0) < 70)
        .slice(0, 5)
    }
    
    return report
  }
  
  // Check if analytics features are enabled
  const isAnalyticsEnabled = computed(() => {
    return config.public.botFeatures.enableAnalytics
  })
  
  return {
    botPerformance,
    botStats,
    performanceTrends,
    statusDistribution,
    recentActivity,
    exportAnalytics,
    generateReport,
    isAnalyticsEnabled
  }
} 