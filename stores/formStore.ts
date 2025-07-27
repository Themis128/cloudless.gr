import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FormConfig, FormField, FormState } from '~/types/common'

export const useFormStore = defineStore('form', () => {
  // State
  const forms = ref<Record<string, FormState>>({})
  const formConfigs = ref<Record<string, FormConfig>>({})
  const isSubmitting = ref<Record<string, boolean>>({})
  const submitErrors = ref<Record<string, string | null>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const getForm = (formId: string) => {
    return forms.value[formId] || {}
  }

  const getFormConfig = (formId: string) => {
    return formConfigs.value[formId]
  }

  const getIsSubmitting = (formId: string) => {
    return isSubmitting.value[formId] || false
  }

  const getSubmitError = (formId: string) => {
    return submitErrors.value[formId] || null
  }

  const isFormValid = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    return Object.values(form).every((field: any) => {
      if (field.required && !field.value) return false
      if (field.error) return false
      return true
    })
  }

  const isFormDirty = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    return Object.values(form).some((field: any) => field.dirty)
  }

  const isFormTouched = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    return Object.values(form).some((field: any) => field.touched)
  }

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

  const createForm = (
    formId: string,
    initialState: FormState,
    config?: Partial<FormConfig>
  ) => {
    try {
      setLoading(true)
      setError(null)

      // Initialize form with default values
      const initializedForm: FormState = {}
      Object.keys(initialState).forEach(key => {
        const field = initialState[key]
        initializedForm[key] = {
          ...field,
          touched: false,
          dirty: false,
          error: undefined,
        }
      })

      forms.value[formId] = initializedForm

      // Set form configuration
      formConfigs.value[formId] = {
        id: formId,
        name: config?.name || formId,
        autoValidate: config?.autoValidate ?? true,
        validateOnBlur: config?.validateOnBlur ?? true,
        validateOnChange: config?.validateOnChange ?? false,
        submitOnEnter: config?.submitOnEnter ?? true,
      }

      // Initialize submission state
      isSubmitting.value[formId] = false
      submitErrors.value[formId] = null

      return true
    } catch (err: any) {
      console.error('Error creating form:', err)
      setError(err.message || 'Failed to create form')
      return false
    } finally {
      setLoading(false)
    }
  }

  const destroyForm = (formId: string) => {
    try {
      delete forms.value[formId]
      delete formConfigs.value[formId]
      delete isSubmitting.value[formId]
      delete submitErrors.value[formId]
      return true
    } catch (err: any) {
      console.error('Error destroying form:', err)
      setError(err.message || 'Failed to destroy form')
      return false
    }
  }

  const validateField = (formId: string, fieldKey: string) => {
    const form = forms.value[formId]
    if (!form) return false

    const field = form[fieldKey]
    if (!field) return false

    // Clear previous error
    field.error = undefined

    // Check required field
    if (field.required && !field.value) {
      field.error = 'This field is required'
      return false
    }

    // Run custom validator
    if (field.validator) {
      const validationError = field.validator(field.value)
      if (validationError) {
        field.error = validationError
        return false
      }
    }

    return true
  }

  const validateForm = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    let isValid = true
    Object.keys(form).forEach(key => {
      if (!validateField(formId, key)) {
        isValid = false
      }
    })

    return isValid
  }

  const setFieldValue = (formId: string, fieldKey: string, value: any) => {
    const form = forms.value[formId]
    if (!form) return false

    const field = form[fieldKey]
    if (!field) return false

    const oldValue = field.value
    field.value = value
    field.dirty = field.value !== oldValue

    // Auto-validate on change if configured
    const config = formConfigs.value[formId]
    if (config?.validateOnChange) {
      validateField(formId, fieldKey)
    }

    return true
  }

  const setFieldError = (formId: string, fieldKey: string, error: string) => {
    const form = forms.value[formId]
    if (!form) return false

    const field = form[fieldKey]
    if (!field) return false

    field.error = error
    return true
  }

  const setFieldTouched = (
    formId: string,
    fieldKey: string,
    touched: boolean = true
  ) => {
    const form = forms.value[formId]
    if (!form) return false

    const field = form[fieldKey]
    if (!field) return false

    field.touched = touched

    // Auto-validate on blur if configured
    const config = formConfigs.value[formId]
    if (config?.validateOnBlur && touched) {
      validateField(formId, fieldKey)
    }

    return true
  }

  const resetForm = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    Object.keys(form).forEach(key => {
      const field = form[key]
      if (field) {
        field.value = field.value // Keep original value, just reset state
        field.error = undefined
        field.touched = false
        field.dirty = false
      }
    })

    submitErrors.value[formId] = null
    return true
  }

  const resetField = (formId: string, fieldKey: string) => {
    const form = forms.value[formId]
    if (!form) return false

    const field = form[fieldKey]
    if (!field) return false

    field.error = undefined
    field.touched = false
    field.dirty = false

    return true
  }

  const setSubmitting = (formId: string, submitting: boolean) => {
    isSubmitting.value[formId] = submitting
  }

  const setSubmitError = (formId: string, error: string | null) => {
    submitErrors.value[formId] = error
  }

  const clearSubmitError = (formId: string) => {
    submitErrors.value[formId] = null
  }

  const getFormData = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return {}

    const data: Record<string, any> = {}
    Object.keys(form).forEach(key => {
      data[key] = form[key].value
    })

    return data
  }

  const setFormData = (formId: string, data: Record<string, any>) => {
    const form = forms.value[formId]
    if (!form) return false

    Object.keys(data).forEach(key => {
      if (form[key]) {
        setFieldValue(formId, key, data[key])
      }
    })

    return true
  }

  const getFormErrors = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return {}

    const errors: Record<string, string> = {}
    Object.keys(form).forEach(key => {
      if (form[key].error) {
        errors[key] = form[key].error!
      }
    })

    return errors
  }

  const hasFormErrors = (formId: string) => {
    const errors = getFormErrors(formId)
    return Object.keys(errors).length > 0
  }

  const clearFormErrors = (formId: string) => {
    const form = forms.value[formId]
    if (!form) return false

    Object.keys(form).forEach(key => {
      form[key].error = undefined
    })

    return true
  }

  const updateFormConfig = (formId: string, config: Partial<FormConfig>) => {
    const existingConfig = formConfigs.value[formId]
    if (!existingConfig) return false

    formConfigs.value[formId] = {
      ...existingConfig,
      ...config,
    }

    return true
  }

  const getFormSummary = (formId: string) => {
    const form = forms.value[formId]
    const config = formConfigs.value[formId]

    if (!form || !config) return null

    return {
      id: config.id,
      name: config.name,
      isValid: isFormValid(formId),
      isDirty: isFormDirty(formId),
      isTouched: isFormTouched(formId),
      isSubmitting: getIsSubmitting(formId),
      hasErrors: hasFormErrors(formId),
      errorCount: Object.keys(getFormErrors(formId)).length,
      fieldCount: Object.keys(form).length,
      data: getFormData(formId),
    }
  }

  return {
    // State
    forms,
    formConfigs,
    isSubmitting,
    submitErrors,
    isLoading,
    error,

    // Computed
    getForm,
    getFormConfig,
    getIsSubmitting,
    getSubmitError,
    isFormValid,
    isFormDirty,
    isFormTouched,

    // Methods
    setLoading,
    setError,
    clearError,
    createForm,
    destroyForm,
    validateField,
    validateForm,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    resetForm,
    resetField,
    setSubmitting,
    setSubmitError,
    clearSubmitError,
    getFormData,
    setFormData,
    getFormErrors,
    hasFormErrors,
    clearFormErrors,
    updateFormConfig,
    getFormSummary,
  }
})
