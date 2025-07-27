import { computed } from 'vue'
import type { Bot } from '~/types/Bot'

// Composable that uses the Pinia store
export const useBotBuilder = (template?: Partial<Bot>) => {
  const botBuilderStore = useBotBuilderStore()

  // Initialize with template if provided
  if (template) {
    botBuilderStore.loadBotTemplate(template)
  }

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    form: computed(() => botBuilderStore.botData),
    step: computed(() => botBuilderStore.currentStep),
    steps: computed(() => botBuilderStore.steps),
    progressValue: computed(() => botBuilderStore.progressPercentage),

    // Computed properties from store
    currentStepData: computed(() => botBuilderStore.currentStepData),
    isFirstStep: computed(() => botBuilderStore.isFirstStep),
    isLastStep: computed(() => botBuilderStore.isLastStep),
    completedSteps: computed(() => botBuilderStore.completedSteps),
    canGoNext: computed(() => botBuilderStore.canGoNext),
    canGoPrevious: computed(() => botBuilderStore.canGoPrevious),
    canSubmit: computed(() => botBuilderStore.canSubmit),
    isValid: computed(() => botBuilderStore.isValid),
    isSubmitting: computed(() => botBuilderStore.isSubmitting),
    error: computed(() => botBuilderStore.error),

    // Methods (delegate to store)
    nextStep: botBuilderStore.nextStep,
    prevStep: botBuilderStore.previousStep,
    goToStep: botBuilderStore.goToStep,
    setCurrentStep: botBuilderStore.setCurrentStep,
    updateStepCompletion: botBuilderStore.updateStepCompletion,
    updateBotData: botBuilderStore.updateBotData,
    updateBotSettings: botBuilderStore.updateBotSettings,
    validateCurrentStep: botBuilderStore.validateCurrentStep,
    createBot: botBuilderStore.createBot,
    resetBotBuilder: botBuilderStore.resetBotBuilder,
    loadBotTemplate: botBuilderStore.loadBotTemplate,
    exportBotConfig: botBuilderStore.exportBotConfig,
    importBotConfig: botBuilderStore.importBotConfig,
    clearError: botBuilderStore.clearError,

    // Legacy methods for backward compatibility
    isStepComplete: (idx: number) => {
      return idx < botBuilderStore.currentStep
    },

    submitBot: async () => {
      return await botBuilderStore.createBot()
    },
  }
}
