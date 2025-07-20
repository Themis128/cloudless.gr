import { ref, computed } from 'vue'

export interface FormField<T = any> {
  value: T
  error?: string
  required?: boolean
  validator?: (val: T) => string | null
}

export interface FormState {
  [key: string]: FormField
}

export const useForm = <T extends FormState>(initialState: T) => {
  const form = ref<T>(initialState)
  const isSubmitting = ref(false)
  const submitError = ref<string | null>(null)

  const isValid = computed(() => {
    return Object.values(form.value).every(field => {
      if (field.required && !field.value) return false
      if (field.error) return false
      return true
    })
  })

  const validateField = (key: keyof T) => {
    const field = form.value[key]
    if (!field) return

    if (field.required && !field.value) {
      field.error = 'This field is required'
      return
    }

    if (field.validator) {
      const validationError = field.validator(field.value)
      field.error = validationError || undefined
    }
  }

  const validateForm = () => {
    Object.keys(form.value).forEach(key => {
      validateField(key as keyof T)
    })
    return isValid.value
  }

  const resetForm = () => {
    Object.keys(form.value).forEach(key => {
      const field = form.value[key as keyof T]
      if (field) {
        field.value = initialState[key as keyof T].value
        field.error = undefined
      }
    })
    submitError.value = null
  }

  const setFieldValue = (key: keyof T, value: any) => {
    const field = form.value[key]
    if (field) {
      field.value = value
      field.error = undefined
    }
  }

  const setFieldError = (key: keyof T, error: string) => {
    const field = form.value[key]
    if (field) {
      field.error = error
    }
  }

  return {
    form,
    isSubmitting,
    submitError,
    isValid,
    validateField,
    validateForm,
    resetForm,
    setFieldValue,
    setFieldError,
  }
} 