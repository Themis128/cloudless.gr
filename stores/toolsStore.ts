import { defineStore } from 'pinia'

export interface Tool {
  id: string
  name: string
  description: string
  icon: string
  color: string
  category: string
  route: string
  estimatedTime: string
  isNew: boolean
  isFavorite: boolean
  lastUsed?: string
  usageCount?: number
}

export interface ToolUsage {
  toolId: string
  timestamp: Date
  duration?: number
  success?: boolean
}

export interface ToolStats {
  total: number
  recent: number
  favorites: number
  new: number
  totalUsage: number
}

export const useToolsStore = defineStore('tools', () => {
  // State
  const tools = ref<Tool[]>([
    {
      id: 'doc-generator',
      name: 'Documentation Generator',
      description: 'Generate comprehensive documentation for your code, APIs, and projects with AI assistance.',
      icon: 'mdi-file-document',
      color: 'primary',
      category: 'Documentation',
      route: '/tools/doc-generator',
      estimatedTime: '2-5 min',
      isNew: false,
      isFavorite: false,
      usageCount: 0
    },
    {
      id: 'test-generator',
      name: 'Test Generator',
      description: 'Create comprehensive unit tests, integration tests, and end-to-end test suites automatically.',
      icon: 'mdi-test-tube',
      color: 'success',
      category: 'Testing',
      route: '/tools/test-generator',
      estimatedTime: '3-7 min',
      isNew: false,
      isFavorite: false,
      usageCount: 0
    },
    {
      id: 'code-analyzer',
      name: 'Code Analyzer',
      description: 'Analyze code quality, identify potential issues, and get optimization suggestions.',
      icon: 'mdi-code-braces',
      color: 'info',
      category: 'Analysis',
      route: '/tools/code-analyzer',
      estimatedTime: '1-3 min',
      isNew: true,
      isFavorite: false,
      usageCount: 0
    },
    {
      id: 'api-tester',
      name: 'API Tester',
      description: 'Test and validate your APIs with a comprehensive testing interface.',
      icon: 'mdi-api',
      color: 'warning',
      category: 'Testing',
      route: '/tools/api-tester',
      estimatedTime: '5-10 min',
      isNew: true,
      isFavorite: false,
      usageCount: 0
    },
    {
      id: 'database-generator',
      name: 'Database Generator',
      description: 'Generate database schemas, migrations, and queries from your models.',
      icon: 'mdi-database',
      color: 'purple',
      category: 'Database',
      route: '/tools/database-generator',
      estimatedTime: '4-8 min',
      isNew: false,
      isFavorite: false,
      usageCount: 0
    },
    {
      id: 'deployment-helper',
      name: 'Deployment Helper',
      description: 'Generate deployment configurations and scripts for various platforms.',
      icon: 'mdi-rocket-launch',
      color: 'deep-orange',
      category: 'Deployment',
      route: '/tools/deployment-helper',
      estimatedTime: '5-15 min',
      isNew: false,
      isFavorite: false,
      usageCount: 0
    }
  ])

  const toolUsage = ref<ToolUsage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const categories = computed(() => {
    const uniqueCategories = [...new Set(tools.value.map(tool => tool.category))]
    return uniqueCategories.map(category => ({
      title: category,
      value: category
    }))
  })

  const filteredTools = computed(() => {
    return (searchQuery: string, selectedCategory: string) => {
      return tools.value.filter(tool => {
        const matchesSearch = !searchQuery || 
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesCategory = !selectedCategory || 
          tool.category === selectedCategory
        
        return matchesSearch && matchesCategory
      })
    }
  })

  const toolStats = computed((): ToolStats => ({
    total: tools.value.length,
    recent: recentlyUsedTools.value.length,
    favorites: tools.value.filter(t => t.isFavorite).length,
    new: tools.value.filter(t => t.isNew).length,
    totalUsage: toolUsage.value.length
  }))

  const recentlyUsedTools = computed(() => {
    const recentUsage = toolUsage.value
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 4)
    
    return recentUsage.map(usage => {
      const tool = tools.value.find(t => t.id === usage.toolId)
      if (!tool) return null
      
      return {
        ...tool,
        lastUsed: formatTimeAgo(usage.timestamp)
      }
    }).filter(Boolean) as Tool[]
  })

  const favoriteTools = computed(() => {
    return tools.value.filter(tool => tool.isFavorite)
  })

  const newTools = computed(() => {
    return tools.value.filter(tool => tool.isNew)
  })

  // Actions
  const toggleFavorite = (toolId: string) => {
    const tool = tools.value.find(t => t.id === toolId)
    if (tool) {
      tool.isFavorite = !tool.isFavorite
      saveFavorites()
    }
  }

  const recordToolUsage = (toolId: string, success = true, duration?: number) => {
    const usage: ToolUsage = {
      toolId,
      timestamp: new Date(),
      success,
      duration
    }
    
    toolUsage.value.unshift(usage)
    
    // Update tool usage count
    const tool = tools.value.find(t => t.id === toolId)
    if (tool) {
      tool.usageCount = (tool.usageCount || 0) + 1
      tool.lastUsed = formatTimeAgo(new Date())
    }
    
    // Keep only last 100 usage records
    if (toolUsage.value.length > 100) {
      toolUsage.value = toolUsage.value.slice(0, 100)
    }
    
    saveUsageHistory()
  }

  const getToolById = (toolId: string) => {
    return tools.value.find(tool => tool.id === toolId)
  }

  const getToolsByCategory = (category: string) => {
    return tools.value.filter(tool => tool.category === category)
  }

  const searchTools = (query: string) => {
    return tools.value.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    )
  }

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'Documentation': 'primary',
      'Testing': 'success',
      'Analysis': 'info',
      'Database': 'purple',
      'Deployment': 'deep-orange'
    }
    return colorMap[category] || 'grey'
  }

  const loadUserPreferences = () => {
    try {
      // Load favorites
      const savedFavorites = localStorage.getItem('tool-favorites')
      if (savedFavorites) {
        const favorites = JSON.parse(savedFavorites)
        tools.value.forEach(tool => {
          tool.isFavorite = favorites.includes(tool.id)
        })
      }

      // Load usage history
      const savedUsage = localStorage.getItem('tool-usage')
      if (savedUsage) {
        const usage = JSON.parse(savedUsage)
        toolUsage.value = usage.map((u: any) => ({
          ...u,
          timestamp: new Date(u.timestamp)
        }))
      }
    } catch (error) {
      console.error('Error loading tool preferences:', error)
    }
  }

  const saveFavorites = () => {
    try {
      const favorites = tools.value
        .filter(tool => tool.isFavorite)
        .map(tool => tool.id)
      localStorage.setItem('tool-favorites', JSON.stringify(favorites))
    } catch (error) {
      console.error('Error saving favorites:', error)
    }
  }

  const saveUsageHistory = () => {
    try {
      localStorage.setItem('tool-usage', JSON.stringify(toolUsage.value))
    } catch (error) {
      console.error('Error saving usage history:', error)
    }
  }

  const clearUsageHistory = () => {
    toolUsage.value = []
    tools.value.forEach(tool => {
      tool.usageCount = 0
      tool.lastUsed = undefined
    })
    saveUsageHistory()
  }

  const resetFavorites = () => {
    tools.value.forEach(tool => {
      tool.isFavorite = false
    })
    saveFavorites()
  }

  // Utility functions
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

  return {
    // State
    tools: readonly(tools),
    toolUsage: readonly(toolUsage),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    categories,
    filteredTools,
    toolStats,
    recentlyUsedTools,
    favoriteTools,
    newTools,

    // Actions
    toggleFavorite,
    recordToolUsage,
    getToolById,
    getToolsByCategory,
    searchTools,
    getCategoryColor,
    loadUserPreferences,
    clearUsageHistory,
    resetFavorites
  }
}) 