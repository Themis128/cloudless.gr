import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface ExecutionResult {
  data: any
  error: string | null
}

interface ExecutionStatus {
  isExecuting: boolean
  progress: number
  result: any
  error: string | null
}

export const usePipelineExecutionStore = defineStore('pipelineExecution', () => {
  const config = useRuntimeConfig()

  // State
  const executingPipelines = ref<Set<string>>(new Set())
  const executionResults = ref<Map<string, any>>(new Map())
  const executionErrors = ref<Map<string, string>>(new Map())
  const executionProgress = ref<Map<string, number>>(new Map())
  const executionHistory = ref<Array<{
    pipelineId: string
    timestamp: string
    status: 'success' | 'error' | 'stopped'
    duration: number
    input: any
    output?: any
    error?: string
  }>>([])

  // Computed properties
  const isAnyExecuting = computed(() => executingPipelines.value.size > 0)
  const executingCount = computed(() => executingPipelines.value.size)
  const hasExecutions = computed(() => executionHistory.value.length > 0)

  // Actions
  const addToExecuting = (pipelineId: string) => {
    executingPipelines.value.add(pipelineId)
  }

  const removeFromExecuting = (pipelineId: string) => {
    executingPipelines.value.delete(pipelineId)
  }

  const setExecutionProgress = (pipelineId: string, progress: number) => {
    executionProgress.value.set(pipelineId, progress)
  }

  const setExecutionResult = (pipelineId: string, result: any) => {
    executionResults.value.set(pipelineId, result)
  }

  const setExecutionError = (pipelineId: string, error: string) => {
    executionErrors.value.set(pipelineId, error)
  }

  const clearExecutionData = (pipelineId: string) => {
    executionResults.value.delete(pipelineId)
    executionErrors.value.delete(pipelineId)
    executionProgress.value.delete(pipelineId)
  }

  const addToHistory = (entry: {
    pipelineId: string
    status: 'success' | 'error' | 'stopped'
    duration: number
    input: any
    output?: any
    error?: string
  }) => {
    executionHistory.value.push({
      ...entry,
      timestamp: new Date().toISOString()
    })
  }

  const executePipeline = async (pipelineId: string, input: any) => {
    if (executingPipelines.value.has(pipelineId)) {
      throw new Error('Pipeline is already executing')
    }

    const startTime = Date.now()
    addToExecuting(pipelineId)
    setExecutionProgress(pipelineId, 0)
    executionErrors.value.delete(pipelineId)

    try {
      // Execute pipeline via API
      const response = await $fetch(`/api/pipelines/${pipelineId}/execute`, {
        method: 'POST' as any,
        body: { input },
        timeout: config.pipelineTimeout,
      }) as any

      if (!response.success) {
        throw new Error(response.error || 'Execution failed')
      }

      const duration = Date.now() - startTime
      setExecutionResult(pipelineId, response.data)
      setExecutionProgress(pipelineId, 100)

      // Add to history
      addToHistory({
        pipelineId,
        status: 'success',
        duration,
        input,
        output: response.data
      })

      return { data: response.data, error: null }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Pipeline execution failed'
      setExecutionError(pipelineId, errorMessage)

      // Add to history
      addToHistory({
        pipelineId,
        status: 'error',
        duration,
        input,
        error: errorMessage
      })

      throw error
    } finally {
      removeFromExecuting(pipelineId)
    }
  }

  const stopPipeline = async (pipelineId: string) => {
    try {
      await $fetch(`/api/pipelines/${pipelineId}/stop`, {
        method: 'POST' as any,
      })

      const duration = Date.now() - Date.now() // This would need to be tracked properly
      removeFromExecuting(pipelineId)
      setExecutionProgress(pipelineId, 0)

      // Add to history
      addToHistory({
        pipelineId,
        status: 'stopped',
        duration: 0,
        input: null
      })
    } catch (error) {
      console.error('Failed to stop pipeline:', error)
    }
  }

  const getExecutionStatus = (pipelineId: string): ExecutionStatus => {
    return {
      isExecuting: executingPipelines.value.has(pipelineId),
      progress: executionProgress.value.get(pipelineId) || 0,
      result: executionResults.value.get(pipelineId),
      error: executionErrors.value.get(pipelineId) || null,
    }
  }

  const getExecutionHistory = (pipelineId?: string) => {
    if (pipelineId) {
      return executionHistory.value.filter(entry => entry.pipelineId === pipelineId)
    }
    return executionHistory.value
  }

  const clearExecutionHistory = () => {
    executionHistory.value = []
  }

  const clearAllExecutionData = () => {
    executingPipelines.value.clear()
    executionResults.value.clear()
    executionErrors.value.clear()
    executionProgress.value.clear()
  }

  const getExecutingPipelines = () => {
    return Array.from(executingPipelines.value)
  }

  const getExecutionStats = () => {
    const total = executionHistory.value.length
    const successful = executionHistory.value.filter(entry => entry.status === 'success').length
    const failed = executionHistory.value.filter(entry => entry.status === 'error').length
    const stopped = executionHistory.value.filter(entry => entry.status === 'stopped').length

    return {
      total,
      successful,
      failed,
      stopped,
      successRate: total > 0 ? (successful / total) * 100 : 0
    }
  }

  return {
    // State
    executingPipelines,
    executionResults,
    executionErrors,
    executionProgress,
    executionHistory,
    
    // Computed
    isAnyExecuting,
    executingCount,
    hasExecutions,
    
    // Actions
    executePipeline,
    stopPipeline,
    getExecutionStatus,
    clearExecutionData,
    getExecutionHistory,
    clearExecutionHistory,
    clearAllExecutionData,
    getExecutingPipelines,
    getExecutionStats,
    
    // Helper methods
    addToExecuting,
    removeFromExecuting,
    setExecutionProgress,
    setExecutionResult,
    setExecutionError
  }
}) 