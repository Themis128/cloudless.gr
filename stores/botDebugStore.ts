import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface BotAction {
  id: string
  botId: string
  botName: string
  action: string
  timestamp: string
  status: 'success' | 'error' | 'pending'
  details?: string
  metadata?: Record<string, any>
}

interface DebugLog {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  context?: Record<string, any>
  botId?: string
}

export const useBotDebugStore = defineStore('botDebug', () => {
  // State
  const botActions = ref<BotAction[]>([])
  const debugLogs = ref<DebugLog[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const recentActions = computed(() =>
    botActions.value
      .slice(0, 10)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
  )

  const errorActions = computed(() =>
    botActions.value.filter(action => action.status === 'error')
  )

  const pendingActions = computed(() =>
    botActions.value.filter(action => action.status === 'pending')
  )

  const debugLogsByLevel = computed(() => {
    const logs = debugLogs.value
    return {
      info: logs.filter(log => log.level === 'info'),
      warn: logs.filter(log => log.level === 'warn'),
      error: logs.filter(log => log.level === 'error'),
      debug: logs.filter(log => log.level === 'debug'),
    }
  })

  // Actions
  const logBotAction = async (action: Omit<BotAction, 'id' | 'timestamp'>) => {
    const newAction: BotAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }

    botActions.value.unshift(newAction)

    // Keep only last 100 actions
    if (botActions.value.length > 100) {
      botActions.value = botActions.value.slice(0, 100)
    }

    try {
      await $fetch('/api/bots/debug/actions', {
        method: 'POST',
        body: newAction,
      })
    } catch (err: any) {
      console.error('Error logging bot action:', err)
    }
  }

  const addDebugLog = (log: Omit<DebugLog, 'id' | 'timestamp'>) => {
    const newLog: DebugLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }

    debugLogs.value.unshift(newLog)

    // Keep only last 200 logs
    if (debugLogs.value.length > 200) {
      debugLogs.value = debugLogs.value.slice(0, 200)
    }
  }

  const fetchBotActions = async (botId?: string, limit: number = 50) => {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (botId) params.append('botId', botId)
      if (limit) params.append('limit', limit.toString())

      const response = await $fetch(
        `/api/bots/debug/actions?${params.toString()}`
      )
      botActions.value = response as BotAction[]
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch bot actions'
      console.error('Error fetching bot actions:', err)
    } finally {
      isLoading.value = false
    }
  }

  const fetchDebugLogs = async (
    botId?: string,
    level?: string,
    limit: number = 100
  ) => {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (botId) params.append('botId', botId)
      if (level) params.append('level', level)
      if (limit) params.append('limit', limit.toString())

      const response = await $fetch(`/api/bots/debug/logs?${params.toString()}`)
      debugLogs.value = response as DebugLog[]
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch debug logs'
      console.error('Error fetching debug logs:', err)
    } finally {
      isLoading.value = false
    }
  }

  const clearBotActions = () => {
    botActions.value = []
  }

  const clearDebugLogs = () => {
    debugLogs.value = []
  }

  const updateActionStatus = (
    actionId: string,
    status: BotAction['status'],
    details?: string
  ) => {
    const action = botActions.value.find(a => a.id === actionId)
    if (action) {
      action.status = status
      if (details) action.details = details
    }
  }

  const getBotActionHistory = async (botId: string) => {
    try {
      const response = await $fetch(`/api/bots/${botId}/debug/history`)
      return response
    } catch (err: any) {
      console.error('Error fetching bot action history:', err)
      throw err
    }
  }

  const exportDebugData = async (botId?: string) => {
    try {
      const params = new URLSearchParams()
      if (botId) params.append('botId', botId)

      const response = await $fetch(
        `/api/bots/debug/export?${params.toString()}`
      )
      return response
    } catch (err: any) {
      console.error('Error exporting debug data:', err)
      throw err
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    botActions,
    debugLogs,
    isLoading,
    error,

    // Computed
    recentActions,
    errorActions,
    pendingActions,
    debugLogsByLevel,

    // Actions
    logBotAction,
    addDebugLog,
    fetchBotActions,
    fetchDebugLogs,
    clearBotActions,
    clearDebugLogs,
    updateActionStatus,
    getBotActionHistory,
    exportDebugData,
    clearError,
  }
})
