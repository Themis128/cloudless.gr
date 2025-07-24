import { ref, computed } from 'vue'

export const usePipelineExecution = () => {
  const config = useRuntimeConfig()
  const { $socket } = useNuxtApp()
  
  // Execution state
  const executingPipelines = ref<Set<string>>(new Set())
  const executionResults = ref<Map<string, any>>(new Map())
  const executionErrors = ref<Map<string, string>>(new Map())
  const executionProgress = ref<Map<string, number>>(new Map())
  
  // Execute a pipeline
  const executePipeline = async (pipelineId: string, input: any) => {
    if (executingPipelines.value.has(pipelineId)) {
      throw new Error('Pipeline is already executing')
    }
    
    executingPipelines.value.add(pipelineId)
    executionProgress.value.set(pipelineId, 0)
    executionErrors.value.delete(pipelineId)
    
    try {
      // Start real-time updates
      if (config.public.pipelineFeatures.enableRealTimeUpdates && $socket) {
        $socket.emit('pipeline-execution-start', { pipelineId, input })
      }
      
      // Execute pipeline via API
      const { data, error } = await $fetch(`/api/pipelines/${pipelineId}/execute`, {
        method: 'POST',
        body: { input },
        timeout: config.pipelineTimeout
      })
      
      if (error) {
        throw new Error(error.message || 'Execution failed')
      }
      
      executionResults.value.set(pipelineId, data)
      executionProgress.value.set(pipelineId, 100)
      
      return { data, error: null }
    } catch (error) {
      const errorMessage = error.message || 'Pipeline execution failed'
      executionErrors.value.set(pipelineId, errorMessage)
      throw error
    } finally {
      executingPipelines.value.delete(pipelineId)
      
      // Stop real-time updates
      if (config.public.pipelineFeatures.enableRealTimeUpdates && $socket) {
        $socket.emit('pipeline-execution-stop', { pipelineId })
      }
    }
  }
  
  // Stop pipeline execution
  const stopPipeline = async (pipelineId: string) => {
    try {
      await $fetch(`/api/pipelines/${pipelineId}/stop`, {
        method: 'POST'
      })
      
      executingPipelines.value.delete(pipelineId)
      executionProgress.value.set(pipelineId, 0)
      
      if (config.public.pipelineFeatures.enableRealTimeUpdates && $socket) {
        $socket.emit('pipeline-execution-stop', { pipelineId })
      }
    } catch (error) {
      console.error('Failed to stop pipeline:', error)
    }
  }
  
  // Get execution status
  const getExecutionStatus = (pipelineId: string) => {
    return {
      isExecuting: executingPipelines.value.has(pipelineId),
      progress: executionProgress.value.get(pipelineId) || 0,
      result: executionResults.value.get(pipelineId),
      error: executionErrors.value.get(pipelineId)
    }
  }
  
  // Clear execution data
  const clearExecutionData = (pipelineId: string) => {
    executionResults.value.delete(pipelineId)
    executionErrors.value.delete(pipelineId)
    executionProgress.value.delete(pipelineId)
  }
  
  // Watch for real-time updates
  if (config.public.pipelineFeatures.enableRealTimeUpdates && $socket) {
    $socket.on('pipeline-progress', ({ pipelineId, progress }) => {
      executionProgress.value.set(pipelineId, progress)
    })
    
    $socket.on('pipeline-result', ({ pipelineId, result }) => {
      executionResults.value.set(pipelineId, result)
      executionProgress.value.set(pipelineId, 100)
      executingPipelines.value.delete(pipelineId)
    })
    
    $socket.on('pipeline-error', ({ pipelineId, error }) => {
      executionErrors.value.set(pipelineId, error)
      executingPipelines.value.delete(pipelineId)
    })
  }
  
  // Computed properties
  const isAnyExecuting = computed(() => executingPipelines.value.size > 0)
  const executingCount = computed(() => executingPipelines.value.size)
  
  return {
    // State
    executingPipelines: readonly(executingPipelines),
    executionResults: readonly(executionResults),
    executionErrors: readonly(executionErrors),
    executionProgress: readonly(executionProgress),
    
    // Computed
    isAnyExecuting,
    executingCount,
    
    // Methods
    executePipeline,
    stopPipeline,
    getExecutionStatus,
    clearExecutionData
  }
} 