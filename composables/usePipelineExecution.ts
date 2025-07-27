import { computed } from 'vue'

// Composable that uses the Pinia store
export const usePipelineExecution = () => {
  const pipelineExecutionStore = usePipelineExecutionStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    executingPipelines: computed(
      () => pipelineExecutionStore.executingPipelines
    ),
    executionResults: computed(() => pipelineExecutionStore.executionResults),
    executionErrors: computed(() => pipelineExecutionStore.executionErrors),
    executionProgress: computed(() => pipelineExecutionStore.executionProgress),

    // Computed
    isAnyExecuting: computed(() => pipelineExecutionStore.isAnyExecuting),
    executingCount: computed(() => pipelineExecutionStore.executingCount),

    // Methods (delegate to store)
    executePipeline: pipelineExecutionStore.executePipeline,
    stopPipeline: pipelineExecutionStore.stopPipeline,
    getExecutionStatus: pipelineExecutionStore.getExecutionStatus,
    clearExecutionData: pipelineExecutionStore.clearExecutionData,

    // Additional store methods
    getExecutionHistory: pipelineExecutionStore.getExecutionHistory,
    clearExecutionHistory: pipelineExecutionStore.clearExecutionHistory,
    clearAllExecutionData: pipelineExecutionStore.clearAllExecutionData,
    getExecutingPipelines: pipelineExecutionStore.getExecutingPipelines,
    getExecutionStats: pipelineExecutionStore.getExecutionStats,

    // Additional computed properties
    hasExecutions: computed(() => pipelineExecutionStore.hasExecutions),
  }
}
