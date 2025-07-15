import { ref, computed } from 'vue'
import { useWizardSteps } from '~/composables/useWizardSteps'

export function useWizard() {
  const { steps } = useWizardSteps()
  const currentStep = ref(0)

  const stepCount = computed(() => steps.length)
  const isFirstStep = computed(() => currentStep.value === 0)
  const isLastStep = computed(() => currentStep.value === steps.length - 1)
  const current = computed(() => steps[currentStep.value])

  function next() {
    if (currentStep.value < steps.length - 1) currentStep.value++
  }
  function prev() {
    if (currentStep.value > 0) currentStep.value--
  }
  function goTo(index: number) {
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
