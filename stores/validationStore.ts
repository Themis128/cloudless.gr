import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
  message?: string
}

export interface ValidationField {
  value: any
  rules: ValidationRule[]
  error?: string
  touched?: boolean
  dirty?: boolean
}

export interface ValidationSchema {
  [key: string]: ValidationRule[]
}

export interface ValidationState {
  [key: string]: ValidationField
}

export const useValidationStore = defineStore('validation', () => {
  // State
  const validationStates = ref<Record<string, ValidationState>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Common validation rules
  const commonRules = {
    required: (message?: string): ValidationRule => ({
      required: true,
      message: message || 'This field is required',
    }),

    email: (message?: string): ValidationRule => ({
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: message || 'Please enter a valid email address',
    }),

    url: (message?: string): ValidationRule => ({
      pattern: /^https?:\/\/.+/,
      message: message || 'Please enter a valid URL',
    }),

    minLength: (length: number, message?: string): ValidationRule => ({
      minLength: length,
      message: message || `Minimum length is ${length} characters`,
    }),

    maxLength: (length: number, message?: string): ValidationRule => ({
      maxLength: length,
      message: message || `Maximum length is ${length} characters`,
    }),

    password: (message?: string): ValidationRule => ({
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
      message:
        message ||
        'Password must contain at least 8 characters, one uppercase, one lowercase, and one number',
    }),

    phone: (message?: string): ValidationRule => ({
      pattern: /^[\+]?[1-9][\d]{0,15}$/,
      message: message || 'Please enter a valid phone number',
    }),

    numeric: (message?: string): ValidationRule => ({
      pattern: /^\d+$/,
      message: message || 'Please enter a valid number',
    }),

    alphanumeric: (message?: string): ValidationRule => ({
      pattern: /^[a-zA-Z0-9]+$/,
      message: message || 'Please enter only letters and numbers',
    }),
  }

  // Bot-specific validation rules
  const botValidationRules = {
    name: [
      commonRules.required('Bot name is required'),
      commonRules.minLength(2, 'Bot name must be at least 2 characters'),
      commonRules.maxLength(50, 'Bot name must be less than 50 characters'),
      commonRules.alphanumeric('Bot name can only contain letters and numbers'),
    ],

    prompt: [
      commonRules.required('Bot prompt is required'),
      commonRules.minLength(10, 'Bot prompt must be at least 10 characters'),
      commonRules.maxLength(
        2000,
        'Bot prompt must be less than 2000 characters'
      ),
    ],

    model: [commonRules.required('Model selection is required')],

    memory: [
      commonRules.maxLength(
        1000,
        'Memory configuration must be less than 1000 characters'
      ),
    ],

    tools: [
      commonRules.maxLength(
        500,
        'Tools configuration must be less than 500 characters'
      ),
    ],
  }

  // Model-specific validation rules
  const modelValidationRules = {
    name: [
      commonRules.required('Model name is required'),
      commonRules.minLength(2, 'Model name must be at least 2 characters'),
      commonRules.maxLength(50, 'Model name must be less than 50 characters'),
    ],

    description: [
      commonRules.maxLength(
        500,
        'Description must be less than 500 characters'
      ),
    ],

    architecture: [commonRules.required('Model architecture is required')],

    epochs: [
      commonRules.required('Number of epochs is required'),
      commonRules.numeric('Epochs must be a number'),
      {
        custom: (value: any) => {
          const num = parseInt(value)
          if (num < 1 || num > 1000) {
            return 'Epochs must be between 1 and 1000'
          }
          return null
        },
      },
    ],
  }

  // Pipeline-specific validation rules
  const pipelineValidationRules = {
    name: [
      commonRules.required('Pipeline name is required'),
      commonRules.minLength(2, 'Pipeline name must be at least 2 characters'),
      commonRules.maxLength(
        50,
        'Pipeline name must be less than 50 characters'
      ),
    ],

    description: [
      commonRules.maxLength(
        500,
        'Description must be less than 500 characters'
      ),
    ],

    steps: [
      commonRules.required('Pipeline steps are required'),
      {
        custom: (value: any) => {
          if (!Array.isArray(value) || value.length === 0) {
            return 'Pipeline must have at least one step'
          }
          return null
        },
      },
    ],
  }

  // Computed properties
  const getValidationState = (formId: string) => {
    return validationStates.value[formId] || {}
  }

  const isFormValid = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return true

    return Object.values(state).every(field => !field.error)
  }

  const hasErrors = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return false

    return Object.values(state).some(field => field.error)
  }

  const getErrors = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return {}

    const errors: Record<string, string> = {}
    Object.keys(state).forEach(key => {
      if (state[key].error) {
        errors[key] = state[key].error!
      }
    })

    return errors
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

  const createValidationState = (
    formId: string,
    schema: ValidationSchema,
    initialValues?: Record<string, any>
  ) => {
    try {
      setLoading(true)
      setError(null)

      const state: ValidationState = {}
      Object.keys(schema).forEach(key => {
        state[key] = {
          value: initialValues?.[key] || '',
          rules: schema[key],
          error: undefined,
          touched: false,
          dirty: false,
        }
      })

      validationStates.value[formId] = state
      return true
    } catch (err: any) {
      console.error('Error creating validation state:', err)
      setError(err.message || 'Failed to create validation state')
      return false
    } finally {
      setLoading(false)
    }
  }

  const destroyValidationState = (formId: string) => {
    try {
      delete validationStates.value[formId]
      return true
    } catch (err: any) {
      console.error('Error destroying validation state:', err)
      setError(err.message || 'Failed to destroy validation state')
      return false
    }
  }

  const validateField = (formId: string, fieldKey: string, value?: any) => {
    const state = validationStates.value[formId]
    if (!state) return false

    const field = state[fieldKey]
    if (!field) return false

    // Update value if provided
    if (value !== undefined) {
      field.value = value
      field.dirty = true
    }

    // Clear previous error
    field.error = undefined

    // Apply validation rules
    for (const rule of field.rules) {
      let errorMessage: string | null = null

      // Required validation
      if (rule.required && !field.value) {
        errorMessage = rule.message || 'This field is required'
      }
      // Min length validation
      else if (
        rule.minLength &&
        field.value &&
        field.value.length < rule.minLength
      ) {
        errorMessage =
          rule.message || `Minimum length is ${rule.minLength} characters`
      }
      // Max length validation
      else if (
        rule.maxLength &&
        field.value &&
        field.value.length > rule.maxLength
      ) {
        errorMessage =
          rule.message || `Maximum length is ${rule.maxLength} characters`
      }
      // Pattern validation
      else if (rule.pattern && field.value && !rule.pattern.test(field.value)) {
        errorMessage = rule.message || 'Invalid format'
      }
      // Custom validation
      else if (rule.custom) {
        errorMessage = rule.custom(field.value)
      }

      if (errorMessage) {
        field.error = errorMessage
        return false
      }
    }

    return true
  }

  const validateForm = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return true

    let isValid = true
    Object.keys(state).forEach(key => {
      if (!validateField(formId, key)) {
        isValid = false
      }
    })

    return isValid
  }

  const setFieldValue = (formId: string, fieldKey: string, value: any) => {
    const state = validationStates.value[formId]
    if (!state) return false

    const field = state[fieldKey]
    if (!field) return false

    field.value = value
    field.dirty = true

    return true
  }

  const setFieldTouched = (
    formId: string,
    fieldKey: string,
    touched: boolean = true
  ) => {
    const state = validationStates.value[formId]
    if (!state) return false

    const field = state[fieldKey]
    if (!field) return false

    field.touched = touched

    // Auto-validate when touched
    if (touched) {
      validateField(formId, fieldKey)
    }

    return true
  }

  const setFieldError = (formId: string, fieldKey: string, error: string) => {
    const state = validationStates.value[formId]
    if (!state) return false

    const field = state[fieldKey]
    if (!field) return false

    field.error = error
    return true
  }

  const clearFieldError = (formId: string, fieldKey: string) => {
    const state = validationStates.value[formId]
    if (!state) return false

    const field = state[fieldKey]
    if (!field) return false

    field.error = undefined
    return true
  }

  const resetValidation = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return false

    Object.keys(state).forEach(key => {
      const field = state[key]
      field.error = undefined
      field.touched = false
      field.dirty = false
    })

    return true
  }

  const getValidationSummary = (formId: string) => {
    const state = validationStates.value[formId]
    if (!state) return null

    const errors = getErrors(formId)
    const touchedFields = Object.values(state).filter(
      field => field.touched
    ).length
    const dirtyFields = Object.values(state).filter(field => field.dirty).length

    return {
      isValid: isFormValid(formId),
      hasErrors: hasErrors(formId),
      errorCount: Object.keys(errors).length,
      fieldCount: Object.keys(state).length,
      touchedFields,
      dirtyFields,
      errors,
    }
  }

  return {
    // State
    validationStates,
    isLoading,
    error,

    // Common rules
    commonRules,
    botValidationRules,
    modelValidationRules,
    pipelineValidationRules,

    // Computed
    getValidationState,
    isFormValid,
    hasErrors,
    getErrors,

    // Methods
    setLoading,
    setError,
    clearError,
    createValidationState,
    destroyValidationState,
    validateField,
    validateForm,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    clearFieldError,
    resetValidation,
    getValidationSummary,
  }
})
