import { defineStore } from 'pinia'
import type { Database } from '~/types/supabase.d'

interface ContactForm {
  name: string
  email: string
  message: string
}

interface ContactState {
  loading: boolean
  success: boolean
  error: string | null
  formData: ContactForm
}

export const useContactStore = defineStore('contact', {
  state: (): ContactState => ({
    loading: false,
    success: false,
    error: null,
    formData: {
      name: '',
      email: '',
      message: '',
    },
  }),

  getters: {
    isFormValid: (state) => {
      return (
        state.formData.name.trim() !== '' &&
        state.formData.email.trim() !== '' &&
        state.formData.message.trim() !== '' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.formData.email)
      )
    },
  },

  actions: {
    updateForm(field: keyof ContactForm, value: string) {
      this.formData[field] = value
    },

    async submitForm(): Promise<boolean> {
      if (!this.isFormValid) {
        this.error = 'Please fill out all fields with valid information'
        return false
      }

      this.loading = true
      this.error = null
      this.success = false

      try {
        const supabase = useSupabaseClient<Database>()
        
        const { error } = await supabase
          .from('contact_messages')
          .insert({
            name: this.formData.name,
            email: this.formData.email,
            message: this.formData.message,
          })

        if (error) throw error

        this.success = true
        this.resetForm()
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to send message. Please try again.'
        console.error('Error submitting contact form:', error)
        return false
      } finally {
        this.loading = false
      }
    },

    resetForm() {
      this.formData = {
        name: '',
        email: '',
        message: '',
      }
    },

    clearError() {
      this.error = null
    },

    clearSuccess() {
      this.success = false
    },

    resetState() {
      this.loading = false
      this.success = false
      this.error = null
      this.resetForm()
    },
  },
})
