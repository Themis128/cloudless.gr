import { computed } from 'vue'
import type { FormField, FormState } from '~/types/common'

// Composable that uses the Pinia store
export const useForm = <T extends FormState>(
  initialState: T,
  formId?: string
) => {
  const formStore = useFormStore()

  // Generate a unique form ID if not provided
  const currentFormId =
    formId || `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create form in store if it doesn't exist
  if (!formStore.getForm(currentFormId)) {
    formStore.createForm(currentFormId, initialState)
  }

  // Get form state from store
  const form = computed(() => formStore.getForm(currentFormId))

  // Computed properties
  const isSubmitting = computed(() => formStore.getIsSubmitting(currentFormId))
  const submitError = computed(() => formStore.getSubmitError(currentFormId))
  const isValid = computed(() => formStore.isFormValid(currentFormId))
  const isDirty = computed(() => formStore.isFormDirty(currentFormId))
  const isTouched = computed(() => formStore.isFormTouched(currentFormId))

  // Methods that delegate to store
  const validateField = (key: keyof T) => {
    return formStore.validateField(currentFormId, key as string)
  }

  const validateForm = () => {
    return formStore.validateForm(currentFormId)
  }

  const resetForm = () => {
    return formStore.resetForm(currentFormId)
  }

  const setFieldValue = (key: keyof T, value: any) => {
    return formStore.setFieldValue(currentFormId, key as string, value)
  }

  const setFieldError = (key: keyof T, error: string) => {
    return formStore.setFieldError(currentFormId, key as string, error)
  }

  const setFieldTouched = (key: keyof T, touched: boolean = true) => {
    return formStore.setFieldTouched(currentFormId, key as string, touched)
  }

  const resetField = (key: keyof T) => {
    return formStore.resetField(currentFormId, key as string)
  }

  const setSubmitting = (submitting: boolean) => {
    return formStore.setSubmitting(currentFormId, submitting)
  }

  const setSubmitError = (error: string | null) => {
    return formStore.setSubmitError(currentFormId, error)
  }

  const clearSubmitError = () => {
    return formStore.clearSubmitError(currentFormId)
  }

  const getFormData = () => {
    return formStore.getFormData(currentFormId)
  }

  const setFormData = (data: Record<string, any>) => {
    return formStore.setFormData(currentFormId, data)
  }

  const getFormErrors = () => {
    return formStore.getFormErrors(currentFormId)
  }

  const hasFormErrors = () => {
    return formStore.hasFormErrors(currentFormId)
  }

  const clearFormErrors = () => {
    return formStore.clearFormErrors(currentFormId)
  }

  const destroyForm = () => {
    return formStore.destroyForm(currentFormId)
  }

  const getFormSummary = () => {
    return formStore.getFormSummary(currentFormId)
  }

  return {
    // Form state
    form,
    isSubmitting,
    submitError,
    isValid,
    isDirty,
    isTouched,

    // Methods
    validateField,
    validateForm,
    resetForm,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    resetField,
    setSubmitting,
    setSubmitError,
    clearSubmitError,
    getFormData,
    setFormData,
    getFormErrors,
    hasFormErrors,
    clearFormErrors,
    destroyForm,
    getFormSummary,

    // Form ID for reference
    formId: currentFormId,
  }
}
