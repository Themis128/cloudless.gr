import type { Ref } from 'vue'
import { computed } from 'vue'

// Composable that uses the Pinia store
export const useBotFormValidation = (
  form: Ref<{
    name: string
    prompt: string
    model: string
    memory?: string
    tools?: string
  }>,
  formId?: string
) => {
  const validationStore = useValidationStore()

  // Generate a unique form ID if not provided
  const currentFormId =
    formId ||
    `bot_form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create validation state if it doesn't exist
  if (!validationStore.getValidationState(currentFormId)) {
    validationStore.createValidationState(
      currentFormId,
      validationStore.botValidationRules,
      {
        name: form.value.name,
        prompt: form.value.prompt,
        model: form.value.model,
        memory: form.value.memory,
        tools: form.value.tools,
      }
    )
  }

  // Get validation state from store
  const validationState = computed(() =>
    validationStore.getValidationState(currentFormId)
  )

  // Computed properties for backward compatibility
  const nameError = computed(() => validationState.value.name?.error || '')
  const promptError = computed(() => validationState.value.prompt?.error || '')
  const modelError = computed(() => validationState.value.model?.error || '')

  // Methods that delegate to store
  const validateName = () => {
    validationStore.validateField(currentFormId, 'name', form.value.name)
  }

  const validatePrompt = () => {
    validationStore.validateField(currentFormId, 'prompt', form.value.prompt)
  }

  const validateModel = () => {
    validationStore.validateField(currentFormId, 'model', form.value.model)
  }

  const validateAll = () => {
    // Update all field values in validation store
    validationStore.setFieldValue(currentFormId, 'name', form.value.name)
    validationStore.setFieldValue(currentFormId, 'prompt', form.value.prompt)
    validationStore.setFieldValue(currentFormId, 'model', form.value.model)
    validationStore.setFieldValue(currentFormId, 'memory', form.value.memory)
    validationStore.setFieldValue(currentFormId, 'tools', form.value.tools)

    // Validate all fields
    return validationStore.validateForm(currentFormId)
  }

  const clearErrors = () => {
    validationStore.resetValidation(currentFormId)
  }

  const isValid = computed(() => validationStore.isFormValid(currentFormId))
  const hasErrors = computed(() => validationStore.hasErrors(currentFormId))
  const getErrors = computed(() => validationStore.getErrors(currentFormId))

  return {
    // Backward compatibility
    nameError,
    promptError,
    modelError,
    validateName,
    validatePrompt,
    validateModel,

    // Enhanced functionality
    validateAll,
    clearErrors,
    isValid,
    hasErrors,
    getErrors,

    // Form ID for reference
    formId: currentFormId,
  }
}
