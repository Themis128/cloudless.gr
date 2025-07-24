import type { Bot } from '~/stores/botStore'

/**
 * Format bot name with proper capitalization
 */
export const formatBotName = (name: string): string => {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

/**
 * Validate bot configuration
 */
export const validateBotConfig = (config: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!config.name || config.name.trim().length < 2) {
    errors.push('Bot name must be at least 2 characters long')
  }
  
  if (!config.prompt || config.prompt.trim().length < 10) {
    errors.push('Bot prompt must be at least 10 characters long')
  }
  
  if (!config.model) {
    errors.push('Bot model is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Get bot status color
 */
export const getBotStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return 'success'
    case 'inactive': return 'warning'
    case 'training': return 'info'
    default: return 'grey'
  }
}

/**
 * Format date for display
 */
export const formatBotDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString()
}

/**
 * Get bot performance metrics
 */
export const getBotPerformance = (bot: Bot) => {
  return {
    responseTime: bot.config?.responseTime || 0,
    accuracy: bot.config?.accuracy || 0,
    conversations: bot.config?.conversations || 0,
    uptime: bot.config?.uptime || 0
  }
}

/**
 * Export bot data to JSON
 */
export const exportBotData = (bots: Bot[]): string => {
  const exportData = bots.map(bot => ({
    id: bot.id,
    name: bot.name,
    description: bot.description,
    status: bot.status,
    config: bot.config,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt
  }))
  
  return JSON.stringify(exportData, null, 2)
}

/**
 * Import bot data from JSON
 */
export const importBotData = (jsonData: string): Partial<Bot>[] => {
  try {
    return JSON.parse(jsonData)
  } catch (error) {
    throw new Error('Invalid JSON data')
  }
}

/**
 * Generate bot statistics
 */
export const generateBotStats = (bots: Bot[]) => {
  const total = bots.length
  const active = bots.filter(bot => bot.status === 'active').length
  const inactive = bots.filter(bot => bot.status === 'inactive').length
  const training = bots.filter(bot => bot.status === 'training').length
  
  return {
    total,
    active,
    inactive,
    training,
    activePercentage: total > 0 ? Math.round((active / total) * 100) : 0
  }
}

/**
 * Filter bots by status
 */
export const filterBotsByStatus = (bots: Bot[], status: string): Bot[] => {
  if (status === 'all') return bots
  return bots.filter(bot => bot.status === status)
}

/**
 * Search bots by name or description
 */
export const searchBots = (bots: Bot[], query: string): Bot[] => {
  if (!query.trim()) return bots
  
  const searchTerm = query.toLowerCase()
  return bots.filter(bot => 
    bot.name.toLowerCase().includes(searchTerm) ||
    bot.description?.toLowerCase().includes(searchTerm)
  )
}

/**
 * Sort bots by various criteria
 */
export const sortBots = (bots: Bot[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): Bot[] => {
  const sortedBots = [...bots]
  
  sortedBots.sort((a, b) => {
    let aValue: any
    let bValue: any
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case 'status':
        aValue = a.status
        bValue = b.status
        break
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
        break
      case 'updatedAt':
        aValue = new Date(a.updatedAt).getTime()
        bValue = new Date(b.updatedAt).getTime()
        break
      default:
        return 0
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })
  
  return sortedBots
} 