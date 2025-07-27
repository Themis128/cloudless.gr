import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface BotStep {
  id: string
  name: string
  description: string
  type: 'details' | 'model' | 'settings' | 'summary'
  isCompleted: boolean
  isRequired: boolean
  validation?: Record<string, any>
}

interface BotBuilderState {
  currentStep: number
  steps: BotStep[]
  botData: Record<string, any>
  isValid: boolean
  isSubmitting: boolean
}

export const useBotBuilderStore = defineStore('botBuilder', () => {
  // State
  const currentStep = ref(0)
  const steps = ref<BotStep[]>([
    {
      id: 'details',
      name: 'Bot Details',
      description: 'Configure basic bot information',
      type: 'details',
      isCompleted: false,
      isRequired: true
    },
    {
      id: 'model',
      name: 'Model Selection',
      description: 'Choose the AI model for your bot',
      type: 'model',
      isCompleted: false,
      isRequired: true
    },
    {
      id: 'settings',
      name: 'Bot Settings',
      description: 'Configure bot behavior and parameters',
      type: 'settings',
      isCompleted: false,
      isRequired: true
    },
    {
      id: 'summary',
      name: 'Review & Create',
      description: 'Review your bot configuration',
      type: 'summary',
      isCompleted: false,
      isRequired: true
    }
  ])

  const botData = ref<Record<string, any>>({
    name: '',
    description: '',
    modelId: '',
    settings: {},
    metadata: {}
  })

  const isValid = ref(false)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const currentStepData = computed(() => steps.value[currentStep.value])
  const isFirstStep = computed(() => currentStep.value === 0)
  const isLastStep = computed(() => currentStep.value === steps.value.length - 1)
  const completedSteps = computed(() => steps.value.filter(step => step.isCompleted))
  const progressPercentage = computed(() => 
    Math.round((completedSteps.value.length / steps.value.length) * 100)
  )

  const canGoNext = computed(() => {
    const currentStepInfo = steps.value[currentStep.value]
    return currentStepInfo.isCompleted && !isLastStep.value
  })

  const canGoPrevious = computed(() => !isFirstStep.value)

  const canSubmit = computed(() => {
    return steps.value.every(step => step.isCompleted) && isValid.value
  })

  // Actions
  const setCurrentStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.value.length) {
      currentStep.value = stepIndex
    }
  }

  const nextStep = () => {
    if (canGoNext.value) {
      currentStep.value++
    }
  }

  const previousStep = () => {
    if (canGoPrevious.value) {
      currentStep.value--
    }
  }

  const goToStep = (stepId: string) => {
    const stepIndex = steps.value.findIndex(step => step.id === stepId)
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex)
    }
  }

  const updateStepCompletion = (stepId: string, isCompleted: boolean) => {
    const step = steps.value.find(s => s.id === stepId)
    if (step) {
      step.isCompleted = isCompleted
    }
  }

  const updateBotData = (key: string, value: any) => {
    botData.value[key] = value
    validateCurrentStep()
  }

  const updateBotSettings = (settings: Record<string, any>) => {
    botData.value.settings = { ...botData.value.settings, ...settings }
    validateCurrentStep()
  }

  const validateCurrentStep = () => {
    const currentStepInfo = steps.value[currentStep.value]
    let stepValid = true

    switch (currentStepInfo.type) {
      case 'details':
        stepValid = !!(botData.value.name && botData.value.description)
        break
      case 'model':
        stepValid = !!botData.value.modelId
        break
      case 'settings':
        stepValid = Object.keys(botData.value.settings).length > 0
        break
      case 'summary':
        stepValid = steps.value.slice(0, -1).every(step => step.isCompleted)
        break
    }

    updateStepCompletion(currentStepInfo.id, stepValid)
    updateOverallValidation()
  }

  const updateOverallValidation = () => {
    isValid.value = steps.value.every(step => step.isCompleted)
  }

  const createBot = async () => {
    if (!canSubmit.value) {
      error.value = 'Please complete all required steps'
      return null
    }

    isSubmitting.value = true
    error.value = null

    try {
      const response = await $fetch('/api/bots', {
        method: 'POST',
        body: botData.value
      })

      // Reset form after successful creation
      resetBotBuilder()
      
      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to create bot'
      console.error('Error creating bot:', err)
      return null
    } finally {
      isSubmitting.value = false
    }
  }

  const resetBotBuilder = () => {
    currentStep.value = 0
    botData.value = {
      name: '',
      description: '',
      modelId: '',
      settings: {},
      metadata: {}
    }
    steps.value.forEach(step => {
      step.isCompleted = false
    })
    isValid.value = false
    error.value = null
  }

  const loadBotTemplate = (template: Record<string, any>) => {
    botData.value = { ...botData.value, ...template }
    validateCurrentStep()
  }

  const exportBotConfig = () => {
    return {
      ...botData.value,
      steps: steps.value.map(step => ({
        id: step.id,
        name: step.name,
        isCompleted: step.isCompleted
      }))
    }
  }

  const importBotConfig = (config: Record<string, any>) => {
    if (config.botData) {
      botData.value = config.botData
    }
    if (config.steps) {
      config.steps.forEach((importedStep: any) => {
        const step = steps.value.find(s => s.id === importedStep.id)
        if (step) {
          step.isCompleted = importedStep.isCompleted
        }
      })
    }
    updateOverallValidation()
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    currentStep,
    steps,
    botData,
    isValid,
    isSubmitting,
    error,
    
    // Computed
    currentStepData,
    isFirstStep,
    isLastStep,
    completedSteps,
    progressPercentage,
    canGoNext,
    canGoPrevious,
    canSubmit,
    
    // Actions
    setCurrentStep,
    nextStep,
    previousStep,
    goToStep,
    updateStepCompletion,
    updateBotData,
    updateBotSettings,
    validateCurrentStep,
    updateOverallValidation,
    createBot,
    resetBotBuilder,
    loadBotTemplate,
    exportBotConfig,
    importBotConfig,
    clearError
  }
}) 