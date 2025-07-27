import { computed } from 'vue'
import { useContactStore } from '~/stores/contactStore'

// Re-export types for backward compatibility
export interface ContactForm {
  name: string
  email: string
  subject: string
  message: string
  csrfToken: string
}

export interface FormErrors {
  name: string
  email: string
  subject: string
  message: string
}

export interface RateLimitInfo {
  remaining?: number
  exceeded?: boolean
  resetTime?: number
}

// Composable that uses the Pinia store
export function useContactUs() {
  const contactStore = useContactStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // Form state (readonly for backward compatibility)
    form: computed(() => contactStore.contactForm),

    // Form status (readonly for backward compatibility)
    isSubmitting: computed(() => contactStore.isLoading),
    isSuccess: computed(() => !!contactStore.successMessage),
    error: computed(() => contactStore.error),

    // Methods (delegate to store)
    submitForm: contactStore.submitContactForm,
    resetForm: contactStore.resetForm,
    updateFormField: contactStore.updateFormField,
    clearError: contactStore.clearError,
    clearSuccessMessage: contactStore.clearSuccessMessage,

    // Additional store methods
    fetchSubmissions: contactStore.fetchSubmissions,
    getSubmission: contactStore.getSubmission,
    updateSubmissionStatus: contactStore.updateSubmissionStatus,
    assignSubmission: contactStore.assignSubmission,
    respondToSubmission: contactStore.respondToSubmission,
    deleteSubmission: contactStore.deleteSubmission,
    exportSubmissions: contactStore.exportSubmissions,

    // Additional computed properties from store
    isFormValid: computed(() => contactStore.isFormValid),
    submissions: computed(() => contactStore.submissions),
    pendingSubmissions: computed(() => contactStore.pendingSubmissions),
    inProgressSubmissions: computed(() => contactStore.inProgressSubmissions),
    resolvedSubmissions: computed(() => contactStore.resolvedSubmissions),
    submissionStats: computed(() => contactStore.submissionStats),
    successMessage: computed(() => contactStore.successMessage),

    // Legacy properties for backward compatibility
    submissionId: computed(() => null), // Not implemented in store yet
    rateLimitInfo: computed(() => null), // Not implemented in store yet
    isRefreshingToken: computed(() => false), // Not implemented in store yet
    tokenTimestamp: computed(() => null), // Not implemented in store yet
    isAutoSaving: computed(() => false), // Not implemented in store yet
    errors: computed(() => ({
      name: '',
      email: '',
      subject: '',
      message: '',
    })), // Validation handled in store
    isValid: computed(() => contactStore.isFormValid),

    // Legacy methods for backward compatibility
    validateName: () => {}, // Validation handled in store
    validateEmail: () => {}, // Validation handled in store
    validateSubject: () => {}, // Validation handled in store
    validateMessage: () => {}, // Validation handled in store
    fetchCsrfToken: async () => {}, // Not implemented in store yet
    checkTokenFreshness: () => {}, // Not implemented in store yet
    refreshCsrfToken: async () => {}, // Not implemented in store yet
    setupAutoTokenRefresh: () => {}, // Not implemented in store yet
  }
}
