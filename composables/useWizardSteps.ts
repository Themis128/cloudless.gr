import { computed } from 'vue'

// Composable that uses the Pinia store
export const useWizardSteps = () => {
  const wizardStore = useWizardStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // Steps from the current wizard
    steps: computed(() => wizardStore.steps),

    // Additional wizard functionality from store
    currentWizard: computed(() => wizardStore.currentWizard),
    defaultWizards: wizardStore.defaultWizards,
    startWizard: wizardStore.startWizard,
    resetWizard: wizardStore.resetWizard,

    // State management
    isLoading: computed(() => wizardStore.isLoading),
    error: computed(() => wizardStore.error),
    setLoading: wizardStore.setLoading,
    setError: wizardStore.setError,
    clearError: wizardStore.clearError,
  }
}
