import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface PipelineStep {
  name: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  startTime?: number
  endTime?: number
  duration?: number
  error?: string
}

interface PipelineStatus {
  step: string
  complete: number
  failed: number
  steps: string[]
  currentStepIndex: number
  isRunning: boolean
  totalSteps: number
}

export const usePipelineDebugStore = defineStore('pipelineDebug', () => {
  // State
  const pipelineStatus = ref<PipelineStatus>({
    step: 'Initializing',
    complete: 0,
    failed: 0,
    steps: ['Ingest', 'Cleanse', 'Transform', 'Train', 'Deploy'],
    currentStepIndex: 0,
    isRunning: false,
    totalSteps: 5,
  })

  const pipelineLogs = ref<string[]>([])
  const stepDetails = ref<PipelineStep[]>([])
  const debugMode = ref(false)
  const autoRun = ref(false)

  // Computed properties
  const progress = computed(() => {
    const total = pipelineStatus.value.totalSteps
    const completed =
      pipelineStatus.value.complete + pipelineStatus.value.failed
    return total > 0 ? (completed / total) * 100 : 0
  })

  const isComplete = computed(() => {
    return (
      pipelineStatus.value.complete + pipelineStatus.value.failed >=
      pipelineStatus.value.totalSteps
    )
  })

  const hasErrors = computed(() => pipelineStatus.value.failed > 0)

  const currentStep = computed(() => {
    return pipelineStatus.value.steps[pipelineStatus.value.currentStepIndex]
  })

  const stepProgress = computed(() => {
    return (
      (pipelineStatus.value.currentStepIndex /
        pipelineStatus.value.totalSteps) *
      100
    )
  })

  // Actions
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    pipelineLogs.value.push(`[${timestamp}] ${message}`)
  }

  const clearLogs = () => {
    pipelineLogs.value = []
  }

  const resetStatus = () => {
    pipelineStatus.value = {
      step: 'Initializing',
      complete: 0,
      failed: 0,
      steps: ['Ingest', 'Cleanse', 'Transform', 'Train', 'Deploy'],
      currentStepIndex: 0,
      isRunning: false,
      totalSteps: 5,
    }
    stepDetails.value = []
    clearLogs()
  }

  const simulateStep = (step: string, delay: number = 500) => {
    if (!pipelineStatus.value.isRunning) {
      pipelineStatus.value.isRunning = true
    }

    const stepIndex = pipelineStatus.value.steps.indexOf(step)
    if (stepIndex === -1) return

    pipelineStatus.value.currentStepIndex = stepIndex
    pipelineStatus.value.step = step

    // Create step detail
    const stepDetail: PipelineStep = {
      name: step,
      status: 'running',
      startTime: Date.now(),
    }
    stepDetails.value[stepIndex] = stepDetail

    addLog(`Starting ${step}...`)

    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Simulate success or failure
        const success = Math.random() > 0.1 // 90% success rate
        stepDetail.status = success ? 'complete' : 'failed'
        stepDetail.endTime = Date.now()
        stepDetail.duration = stepDetail.endTime - stepDetail.startTime!

        if (success) {
          pipelineStatus.value.complete++
          addLog(`${step} complete.`)
        } else {
          pipelineStatus.value.failed++
          stepDetail.error = `Failed to complete ${step}`
          addLog(`${step} failed.`)
        }

        // Move to next step
        if (stepIndex < pipelineStatus.value.totalSteps - 1) {
          pipelineStatus.value.currentStepIndex = stepIndex + 1
        } else {
          pipelineStatus.value.isRunning = false
        }

        resolve()
      }, delay)
    })
  }

  const runAll = async (delay: number = 500) => {
    resetStatus()
    pipelineStatus.value.isRunning = true

    for (const step of pipelineStatus.value.steps) {
      if (!pipelineStatus.value.isRunning) break
      await simulateStep(step, delay)
    }

    pipelineStatus.value.isRunning = false
    addLog('Pipeline execution completed.')
  }

  const stopExecution = () => {
    pipelineStatus.value.isRunning = false
    addLog('Pipeline execution stopped.')
  }

  const setDebugMode = (enabled: boolean) => {
    debugMode.value = enabled
    addLog(`Debug mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  const setAutoRun = (enabled: boolean) => {
    autoRun.value = enabled
  }

  const getStepDetails = (stepName: string) => {
    return stepDetails.value.find(step => step.name === stepName)
  }

  const getExecutionSummary = () => {
    const total = pipelineStatus.value.totalSteps
    const successful = pipelineStatus.value.complete
    const failed = pipelineStatus.value.failed
    const successRate = total > 0 ? (successful / total) * 100 : 0

    return {
      total,
      successful,
      failed,
      successRate,
      isComplete: isComplete.value,
      hasErrors: hasErrors.value,
      duration: stepDetails.value.reduce((total, step) => {
        return total + (step.duration || 0)
      }, 0),
    }
  }

  const exportLogs = () => {
    return pipelineLogs.value.join('\n')
  }

  const importLogs = (logs: string) => {
    pipelineLogs.value = logs.split('\n').filter(log => log.trim())
  }

  return {
    // State
    pipelineStatus,
    pipelineLogs,
    stepDetails,
    debugMode,
    autoRun,

    // Computed
    progress,
    isComplete,
    hasErrors,
    currentStep,
    stepProgress,

    // Actions
    addLog,
    clearLogs,
    resetStatus,
    simulateStep,
    runAll,
    stopExecution,
    setDebugMode,
    setAutoRun,
    getStepDetails,
    getExecutionSummary,
    exportLogs,
    importLogs,
  }
})
