import { computed } from 'vue'

// Composable that uses the Pinia store
export const usePipelineDebug = () => {
  const pipelineDebugStore = usePipelineDebugStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    pipelineStatus: computed(() => pipelineDebugStore.pipelineStatus),
    pipelineLogs: computed(() => pipelineDebugStore.pipelineLogs),

    // Methods (delegate to store)
    simulateStep: pipelineDebugStore.simulateStep,
    runAll: pipelineDebugStore.runAll,

    // Additional store methods
    addLog: pipelineDebugStore.addLog,
    clearLogs: pipelineDebugStore.clearLogs,
    resetStatus: pipelineDebugStore.resetStatus,
    stopExecution: pipelineDebugStore.stopExecution,
    setDebugMode: pipelineDebugStore.setDebugMode,
    setAutoRun: pipelineDebugStore.setAutoRun,
    getStepDetails: pipelineDebugStore.getStepDetails,
    getExecutionSummary: pipelineDebugStore.getExecutionSummary,
    exportLogs: pipelineDebugStore.exportLogs,
    importLogs: pipelineDebugStore.importLogs,

    // Additional computed properties from store
    progress: computed(() => pipelineDebugStore.progress),
    isComplete: computed(() => pipelineDebugStore.isComplete),
    hasErrors: computed(() => pipelineDebugStore.hasErrors),
    currentStep: computed(() => pipelineDebugStore.currentStep),
    stepProgress: computed(() => pipelineDebugStore.stepProgress),
    debugMode: computed(() => pipelineDebugStore.debugMode),
    autoRun: computed(() => pipelineDebugStore.autoRun),
    stepDetails: computed(() => pipelineDebugStore.stepDetails),
  }
}
