import { computed, ref } from 'vue'
import { useWizardSteps } from '~/composables/useWizardSteps'

export const useWizard = () => {
  const { steps } = useWizardSteps()
  const currentStep = ref(0)

  const stepCount = computed(() => steps.length)
  const isFirstStep = computed(() => currentStep.value === 0)
  const isLastStep = computed(() => currentStep.value === steps.length - 1)
  const current = computed(() => steps[currentStep.value])

  const next = () => {
    if (currentStep.value < steps.length - 1) currentStep.value++
  }
  const prev = () => {
    if (currentStep.value > 0) currentStep.value--
  }
  const goTo = (index: number) => {
    if (index >= 0 && index < steps.length) currentStep.value = index
  }

  return {
    steps,
    currentStep,
    stepCount,
    isFirstStep,
    isLastStep,
    current,
    next,
    prev,
    goTo
  }
}
