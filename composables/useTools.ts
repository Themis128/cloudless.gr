import { computed } from 'vue'
import { useToolsStore } from '~/stores/toolsStore'

export const useTools = () => {
  const toolsStore = useToolsStore()

  // Tool management
  const getToolById = (toolId: string) => {
    return toolsStore.getToolById(toolId)
  }

  const getToolsByCategory = (category: string) => {
    return toolsStore.getToolsByCategory(category)
  }

  const searchTools = (query: string) => {
    return toolsStore.searchTools(query)
  }

  const toggleFavorite = (toolId: string) => {
    toolsStore.toggleFavorite(toolId)
  }

  // Usage tracking
  const recordToolUsage = (toolId: string, success = true, duration?: number) => {
    toolsStore.recordToolUsage(toolId, success, duration)
  }

  // Statistics and analytics
  const toolStats = computed(() => toolsStore.toolStats)
  const recentlyUsedTools = computed(() => toolsStore.recentlyUsedTools)
  const favoriteTools = computed(() => toolsStore.favoriteTools)
  const newTools = computed(() => toolsStore.newTools)

  // Filtering and search
  const filterTools = (searchQuery: string, selectedCategory: string) => {
    return toolsStore.filteredTools(searchQuery, selectedCategory)
  }

  const categories = computed(() => toolsStore.categories)

  // Utility functions
  const getCategoryColor = (category: string) => {
    return toolsStore.getCategoryColor(category)
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return 'Just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days > 1 ? 's' : ''} ago`
    }
  }

  // Tool-specific helpers
  const getToolUsageCount = (toolId: string) => {
    const tool = toolsStore.getToolById(toolId)
    return tool?.usageCount || 0
  }

  const getToolLastUsed = (toolId: string) => {
    const tool = toolsStore.getToolById(toolId)
    return tool?.lastUsed
  }

  const isToolFavorite = (toolId: string) => {
    const tool = toolsStore.getToolById(toolId)
    return tool?.isFavorite || false
  }

  const isToolNew = (toolId: string) => {
    const tool = toolsStore.getToolById(toolId)
    return tool?.isNew || false
  }

  // Export and import functionality
  const exportToolData = () => {
    const data = {
      tools: toolsStore.tools,
      usage: toolsStore.toolUsage,
      stats: toolsStore.toolStats,
    }

    const dataStr = JSON.stringify(data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'tools-data.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importToolData = (data: any) => {
    // This would need to be implemented in the store
    console.log('Import tool data:', data)
  }

  // Tool recommendations
  const getRecommendedTools = (category?: string) => {
    const tools = category ? toolsStore.getToolsByCategory(category) : toolsStore.tools

    return tools.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5)
  }

  const getPopularTools = () => {
    return toolsStore.tools.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 6)
  }

  // Tool categories with metadata
  const categoryMetadata = computed(() => {
    const categories = toolsStore.categories
    return categories.map(category => {
      const toolsInCategory = toolsStore.getToolsByCategory(category.value)
      const totalUsage = toolsInCategory.reduce((sum, tool) => sum + (tool.usageCount || 0), 0)

      return {
        ...category,
        toolCount: toolsInCategory.length,
        totalUsage,
        averageUsage: toolsInCategory.length > 0 ? totalUsage / toolsInCategory.length : 0,
      }
    })
  })

  return {
    // Core functionality
    getToolById,
    getToolsByCategory,
    searchTools,
    toggleFavorite,
    recordToolUsage,

    // Computed properties
    toolStats,
    recentlyUsedTools,
    favoriteTools,
    newTools,
    categories,
    categoryMetadata,

    // Filtering
    filterTools,

    // Utilities
    getCategoryColor,
    formatTimeAgo,

    // Tool-specific helpers
    getToolUsageCount,
    getToolLastUsed,
    isToolFavorite,
    isToolNew,

    // Data management
    exportToolData,
    importToolData,

    // Recommendations
    getRecommendedTools,
    getPopularTools,
  }
}
