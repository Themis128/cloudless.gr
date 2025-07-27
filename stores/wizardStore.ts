import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface WizardStep {
  title: string
  subtitle: string
  path: string
  description: string
  completed?: boolean
  valid?: boolean
  data?: any
}

interface WizardConfig {
  id: string
  name: string
  type: 'bot' | 'model' | 'pipeline' | 'custom'
  steps: WizardStep[]
  allowSkip?: boolean
  allowBack?: boolean
  autoSave?: boolean
}

export const useWizardStore = defineStore('wizard', () => {
  // State
  const currentWizard = ref<WizardConfig | null>(null)
  const currentStep = ref(0)
  const stepData = ref<Record<number, any>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Default wizard configurations
  const defaultWizards = {
    pipeline: {
      id: 'pipeline-wizard',
      name: 'Pipeline Creation Wizard',
      type: 'pipeline' as const,
      allowSkip: false,
      allowBack: true,
      autoSave: true,
      steps: [
        {
          title: 'Pipeline Details',
          subtitle: 'Set basic pipeline information',
          path: '/pipelines/create',
          description: `<strong>Step 1: Pipeline Details</strong><br>Set up your pipeline's basic information.<br><ul><li>Enter a descriptive name for your pipeline</li><li>Add a description to help team members understand its purpose</li><li>Configure basic pipeline settings</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Model Selection',
          subtitle: 'Choose models for your pipeline',
          path: '/pipelines/create',
          description: `<strong>Step 2: Model Selection</strong><br>Select the AI models to use in your pipeline.<br><ul><li>Choose from available trained models</li><li>Configure model-specific parameters</li><li>Set up model input/output mappings</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Pipeline Config',
          subtitle: 'Configure pipeline steps and logic',
          path: '/pipelines/create',
          description: `<strong>Step 3: Pipeline Configuration</strong><br>Define your pipeline's processing steps and logic.<br><ul><li>Add and order processing steps</li><li>Configure step parameters and connections</li><li>Set up error handling and retries</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Review',
          subtitle: 'Review and validate pipeline',
          path: '/pipelines/create',
          description: `<strong>Step 4: Review & Validate</strong><br>Review your pipeline configuration before creation.<br><ul><li>Verify all settings and connections</li><li>Check for potential issues or optimizations</li><li>Confirm pipeline structure and flow</li></ul>`,
          completed: false,
          valid: false,
        },
      ],
    },
    bot: {
      id: 'bot-wizard',
      name: 'Bot Creation Wizard',
      type: 'bot' as const,
      allowSkip: false,
      allowBack: true,
      autoSave: true,
      steps: [
        {
          title: 'Bot Details',
          subtitle: 'Set basic bot information',
          path: '/bots/create',
          description: `<strong>Step 1: Bot Details</strong><br>Set up your bot's basic information.<br><ul><li>Enter a descriptive name for your bot</li><li>Add a description to explain its purpose</li><li>Configure basic bot settings</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Model Selection',
          subtitle: 'Choose AI model for your bot',
          path: '/bots/create',
          description: `<strong>Step 2: Model Selection</strong><br>Select the AI model to power your bot.<br><ul><li>Choose from available language models</li><li>Configure model parameters</li><li>Set up conversation settings</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Personality & Behavior',
          subtitle: 'Define bot personality and behavior',
          path: '/bots/create',
          description: `<strong>Step 3: Personality & Behavior</strong><br>Define how your bot should behave and respond.<br><ul><li>Set the bot's personality and tone</li><li>Configure response patterns</li><li>Define conversation boundaries</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Review & Test',
          subtitle: 'Review and test your bot',
          path: '/bots/create',
          description: `<strong>Step 4: Review & Test</strong><br>Review your bot configuration and test it.<br><ul><li>Verify all settings and configurations</li><li>Test the bot with sample conversations</li><li>Make final adjustments if needed</li></ul>`,
          completed: false,
          valid: false,
        },
      ],
    },
    model: {
      id: 'model-wizard',
      name: 'Model Training Wizard',
      type: 'model' as const,
      allowSkip: false,
      allowBack: true,
      autoSave: true,
      steps: [
        {
          title: 'Model Details',
          subtitle: 'Set basic model information',
          path: '/models/create',
          description: `<strong>Step 1: Model Details</strong><br>Set up your model's basic information.<br><ul><li>Enter a descriptive name for your model</li><li>Add a description to explain its purpose</li><li>Configure basic model settings</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Dataset Selection',
          subtitle: 'Choose training dataset',
          path: '/models/create',
          description: `<strong>Step 2: Dataset Selection</strong><br>Select the dataset for training your model.<br><ul><li>Choose from available datasets</li><li>Configure data preprocessing</li><li>Set up data validation</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Training Configuration',
          subtitle: 'Configure training parameters',
          path: '/models/create',
          description: `<strong>Step 3: Training Configuration</strong><br>Configure the training process.<br><ul><li>Set training parameters</li><li>Configure model architecture</li><li>Set up evaluation metrics</li></ul>`,
          completed: false,
          valid: false,
        },
        {
          title: 'Review & Start Training',
          subtitle: 'Review and start training',
          path: '/models/create',
          description: `<strong>Step 4: Review & Start Training</strong><br>Review your model configuration and start training.<br><ul><li>Verify all settings and configurations</li><li>Check resource requirements</li><li>Start the training process</li></ul>`,
          completed: false,
          valid: false,
        },
      ],
    },
  }

  // Computed properties
  const steps = computed(() => currentWizard.value?.steps || [])
  const stepCount = computed(() => steps.value.length)
  const isFirstStep = computed(() => currentStep.value === 0)
  const isLastStep = computed(() => currentStep.value === stepCount.value - 1)
  const current = computed(() => steps.value[currentStep.value])
  const progress = computed(() => {
    if (stepCount.value === 0) return 0
    return ((currentStep.value + 1) / stepCount.value) * 100
  })
  const completedSteps = computed(
    () => steps.value.filter(step => step.completed).length
  )
  const canProceed = computed(() => {
    if (!current.value) return false
    return current.value.valid || currentWizard.value?.allowSkip
  })
  const canGoBack = computed(() => {
    return currentWizard.value?.allowBack && !isFirstStep.value
  })

  // Actions
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  const startWizard = (
    wizardType: keyof typeof defaultWizards | WizardConfig
  ) => {
    try {
      setLoading(true)
      setError(null)

      if (typeof wizardType === 'string') {
        currentWizard.value = { ...defaultWizards[wizardType] }
      } else {
        currentWizard.value = wizardType
      }

      currentStep.value = 0
      stepData.value = {}

      // Reset step states
      if (currentWizard.value) {
        currentWizard.value.steps.forEach(step => {
          step.completed = false
          step.valid = false
        })
      }
    } catch (err: any) {
      console.error('Error starting wizard:', err)
      setError(err.message || 'Failed to start wizard')
    } finally {
      setLoading(false)
    }
  }

  const next = () => {
    if (currentStep.value < stepCount.value - 1) {
      // Mark current step as completed
      if (current.value) {
        current.value.completed = true
      }
      currentStep.value++
    }
  }

  const prev = () => {
    if (currentStep.value > 0) {
      currentStep.value--
    }
  }

  const goTo = (index: number) => {
    if (index >= 0 && index < stepCount.value) {
      currentStep.value = index
    }
  }

  const goToStep = (stepTitle: string) => {
    const stepIndex = steps.value.findIndex(step => step.title === stepTitle)
    if (stepIndex !== -1) {
      goTo(stepIndex)
    }
  }

  const setStepData = (stepIndex: number, data: any) => {
    stepData.value[stepIndex] = data
  }

  const getStepData = (stepIndex: number) => {
    return stepData.value[stepIndex] || null
  }

  const setStepValid = (stepIndex: number, valid: boolean) => {
    if (steps.value[stepIndex]) {
      steps.value[stepIndex].valid = valid
    }
  }

  const setStepCompleted = (stepIndex: number, completed: boolean) => {
    if (steps.value[stepIndex]) {
      steps.value[stepIndex].completed = completed
    }
  }

  const validateCurrentStep = () => {
    if (current.value) {
      // Basic validation - can be extended based on step type
      const hasData = stepData.value[currentStep.value] !== undefined
      current.value.valid = hasData
      return hasData
    }
    return false
  }

  const skipStep = () => {
    if (currentWizard.value?.allowSkip) {
      next()
    }
  }

  const resetWizard = () => {
    currentWizard.value = null
    currentStep.value = 0
    stepData.value = {}
  }

  const getWizardSummary = () => {
    if (!currentWizard.value) return null

    return {
      id: currentWizard.value.id,
      name: currentWizard.value.name,
      type: currentWizard.value.type,
      currentStep: currentStep.value + 1,
      totalSteps: stepCount.value,
      progress: progress.value,
      completedSteps: completedSteps.value,
      stepData: stepData.value,
    }
  }

  const saveWizardState = () => {
    if (!currentWizard.value?.autoSave) return

    try {
      const state = {
        wizardId: currentWizard.value.id,
        currentStep: currentStep.value,
        stepData: stepData.value,
        timestamp: new Date().toISOString(),
      }

      if (process.client) {
        localStorage.setItem(
          `wizard_${currentWizard.value.id}`,
          JSON.stringify(state)
        )
      }
    } catch (err) {
      console.error('Error saving wizard state:', err)
    }
  }

  const loadWizardState = (wizardId: string) => {
    if (!process.client) return false

    try {
      const savedState = localStorage.getItem(`wizard_${wizardId}`)
      if (savedState) {
        const state = JSON.parse(savedState)
        currentStep.value = state.currentStep || 0
        stepData.value = state.stepData || {}
        return true
      }
    } catch (err) {
      console.error('Error loading wizard state:', err)
    }
    return false
  }

  const clearWizardState = (wizardId: string) => {
    if (process.client) {
      localStorage.removeItem(`wizard_${wizardId}`)
    }
  }

  return {
    // State
    currentWizard,
    currentStep,
    stepData,
    isLoading,
    error,
    defaultWizards,

    // Computed
    steps,
    stepCount,
    isFirstStep,
    isLastStep,
    current,
    progress,
    completedSteps,
    canProceed,
    canGoBack,

    // Methods
    setLoading,
    setError,
    clearError,
    startWizard,
    next,
    prev,
    goTo,
    goToStep,
    setStepData,
    getStepData,
    setStepValid,
    setStepCompleted,
    validateCurrentStep,
    skipStep,
    resetWizard,
    getWizardSummary,
    saveWizardState,
    loadWizardState,
    clearWizardState,
  }
})
