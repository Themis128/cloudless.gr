import { computed } from 'vue'

// Re-export types for backward compatibility
interface StepGuide {
  title: string
  content: string
  fullContent: string
  tips: string[]
}

interface TemplateInfo {
  name: string
  description: string
  category?: string
  tags?: string[]
  [key: string]: any
}

// Composable that uses the Pinia store
export const useStepGuides = () => {
  const stepGuidesStore = useStepGuidesStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    currentBuilder: computed(() => stepGuidesStore.currentBuilder),
    currentStep: computed(() => stepGuidesStore.currentStep),

    // Computed properties (delegate to store)
    currentGuide: computed(() => stepGuidesStore.currentGuide),
    currentTemplate: computed(() => stepGuidesStore.currentTemplate),

    // Data (readonly for backward compatibility)
    botTemplates: computed(() => stepGuidesStore.botTemplates),

    // Methods (delegate to store)
    setBuilder: stepGuidesStore.setBuilder,
    setStep: stepGuidesStore.setStep,

    // Additional store methods
    nextStep: stepGuidesStore.nextStep,
    previousStep: stepGuidesStore.previousStep,
    resetSteps: stepGuidesStore.resetSteps,
    getStepGuide: stepGuidesStore.getStepGuide,
    getTemplateByName: stepGuidesStore.getTemplateByName,
    getTemplatesByCategory: stepGuidesStore.getTemplatesByCategory,
    getTemplatesByTag: stepGuidesStore.getTemplatesByTag,

    // Additional computed properties from store
    totalSteps: computed(() => stepGuidesStore.totalSteps),
    isFirstStep: computed(() => stepGuidesStore.isFirstStep),
    isLastStep: computed(() => stepGuidesStore.isLastStep),
    progressPercentage: computed(() => stepGuidesStore.progressPercentage),
  }
}
