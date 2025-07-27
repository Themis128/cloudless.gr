import { computed } from 'vue'

// Composable that uses the Pinia store
export const useWizard = () => {
  const wizardStore = useWizardStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    currentStep: computed(() => wizardStore.currentStep),

    // Computed properties
    steps: computed(() => wizardStore.steps),
    stepCount: computed(() => wizardStore.stepCount),
    isFirstStep: computed(() => wizardStore.isFirstStep),
    isLastStep: computed(() => wizardStore.isLastStep),
    current: computed(() => wizardStore.current),

    // Methods (delegate to store)
    next: wizardStore.next,
    prev: wizardStore.prev,
    goTo: wizardStore.goTo,

    // Additional wizard functionality from store
    progress: computed(() => wizardStore.progress),
    completedSteps: computed(() => wizardStore.completedSteps),
    canProceed: computed(() => wizardStore.canProceed),
    canGoBack: computed(() => wizardStore.canGoBack),
    startWizard: wizardStore.startWizard,
    goToStep: wizardStore.goToStep,
    setStepData: wizardStore.setStepData,
    getStepData: wizardStore.getStepData,
    setStepValid: wizardStore.setStepValid,
    setStepCompleted: wizardStore.setStepCompleted,
    validateCurrentStep: wizardStore.validateCurrentStep,
    skipStep: wizardStore.skipStep,
    resetWizard: wizardStore.resetWizard,
    getWizardSummary: wizardStore.getWizardSummary,
    saveWizardState: wizardStore.saveWizardState,
    loadWizardState: wizardStore.loadWizardState,
    clearWizardState: wizardStore.clearWizardState,

    // State management
    isLoading: computed(() => wizardStore.isLoading),
    error: computed(() => wizardStore.error),
    setLoading: wizardStore.setLoading,
    setError: wizardStore.setError,
    clearError: wizardStore.clearError,
  }
}
