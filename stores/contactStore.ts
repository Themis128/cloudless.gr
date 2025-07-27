import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface ContactForm {
  name: string
  email: string
  subject: string
  message: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
}

interface ContactSubmission {
  id: string
  name: string
  email: string
  subject: string
  message: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  assignedTo?: string
  response?: string
}

export const useContactStore = defineStore('contact', () => {
  // State
  const contactForm = ref<ContactForm>({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: '',
    priority: 'medium',
  })

  const submissions = ref<ContactSubmission[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  // Computed properties
  const isFormValid = computed(() => {
    const form = contactForm.value
    return !!(form.name && form.email && form.subject && form.message)
  })

  const pendingSubmissions = computed(() =>
    submissions.value.filter(sub => sub.status === 'pending')
  )

  const inProgressSubmissions = computed(() =>
    submissions.value.filter(sub => sub.status === 'in-progress')
  )

  const resolvedSubmissions = computed(() =>
    submissions.value.filter(sub => sub.status === 'resolved')
  )

  const submissionStats = computed(() => ({
    total: submissions.value.length,
    pending: pendingSubmissions.value.length,
    inProgress: inProgressSubmissions.value.length,
    resolved: resolvedSubmissions.value.length,
  }))

  // Actions
  const updateFormField = (field: keyof ContactForm, value: any) => {
    contactForm.value[field] = value
  }

  const resetForm = () => {
    contactForm.value = {
      name: '',
      email: '',
      subject: '',
      message: '',
      category: '',
      priority: 'medium',
    }
    error.value = null
    successMessage.value = null
  }

  const submitContactForm = async () => {
    if (!isFormValid.value) {
      error.value = 'Please fill in all required fields'
      return false
    }

    isLoading.value = true
    error.value = null
    successMessage.value = null

    try {
      const response = await $fetch('/api/contact', {
        method: 'POST',
        body: contactForm.value,
      })

      successMessage.value =
        'Thank you for your message! We will get back to you soon.'
      resetForm()

      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to submit contact form'
      console.error('Error submitting contact form:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const fetchSubmissions = async (status?: string, limit: number = 50) => {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      if (limit) params.append('limit', limit.toString())

      const response = await $fetch(
        `/api/contact/submissions?${params.toString()}`
      )
      submissions.value = response as ContactSubmission[]
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch submissions'
      console.error('Error fetching submissions:', err)
    } finally {
      isLoading.value = false
    }
  }

  const getSubmission = async (submissionId: string) => {
    try {
      const response = await $fetch(`/api/contact/submissions/${submissionId}`)
      return response
    } catch (err: any) {
      console.error('Error fetching submission:', err)
      throw err
    }
  }

  const updateSubmissionStatus = async (
    submissionId: string,
    status: ContactSubmission['status']
  ) => {
    try {
      const response = await $fetch(
        `/api/contact/submissions/${submissionId}/status`,
        {
          method: 'PATCH',
          body: { status },
        }
      )

      // Update local state
      const submission = submissions.value.find(sub => sub.id === submissionId)
      if (submission) {
        submission.status = status
        submission.updatedAt = new Date().toISOString()
      }

      return response
    } catch (err: any) {
      console.error('Error updating submission status:', err)
      throw err
    }
  }

  const assignSubmission = async (submissionId: string, assignedTo: string) => {
    try {
      const response = await $fetch(
        `/api/contact/submissions/${submissionId}/assign`,
        {
          method: 'PATCH',
          body: { assignedTo },
        }
      )

      // Update local state
      const submission = submissions.value.find(sub => sub.id === submissionId)
      if (submission) {
        submission.assignedTo = assignedTo
        submission.updatedAt = new Date().toISOString()
      }

      return response
    } catch (err: any) {
      console.error('Error assigning submission:', err)
      throw err
    }
  }

  const respondToSubmission = async (
    submissionId: string,
    response: string
  ) => {
    try {
      const responseData = await $fetch(
        `/api/contact/submissions/${submissionId}/respond`,
        {
          method: 'POST',
          body: { response },
        }
      )

      // Update local state
      const submission = submissions.value.find(sub => sub.id === submissionId)
      if (submission) {
        submission.response = response
        submission.status = 'resolved'
        submission.updatedAt = new Date().toISOString()
      }

      return responseData
    } catch (err: any) {
      console.error('Error responding to submission:', err)
      throw err
    }
  }

  const deleteSubmission = async (submissionId: string) => {
    try {
      await $fetch(`/api/contact/submissions/${submissionId}`, {
        method: 'DELETE',
      })

      // Remove from local state
      submissions.value = submissions.value.filter(
        sub => sub.id !== submissionId
      )
    } catch (err: any) {
      console.error('Error deleting submission:', err)
      throw err
    }
  }

  const exportSubmissions = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await $fetch(
        `/api/contact/submissions/export?format=${format}`
      )
      return response
    } catch (err: any) {
      console.error('Error exporting submissions:', err)
      throw err
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearSuccessMessage = () => {
    successMessage.value = null
  }

  return {
    // State
    contactForm,
    submissions,
    isLoading,
    error,
    successMessage,

    // Computed
    isFormValid,
    pendingSubmissions,
    inProgressSubmissions,
    resolvedSubmissions,
    submissionStats,

    // Actions
    updateFormField,
    resetForm,
    submitContactForm,
    fetchSubmissions,
    getSubmission,
    updateSubmissionStatus,
    assignSubmission,
    respondToSubmission,
    deleteSubmission,
    exportSubmissions,
    clearError,
    clearSuccessMessage,
  }
})
