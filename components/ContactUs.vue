<template>
  <div class="contact-flip-card">
    <div :class="['flip-card-inner', { flipped: isFlipped }]">
      <!-- Front Side: Contact Form -->
      <div class="flip-card-front">
        <VCard elevation="4" class="pa-4">
          <VCardTitle>Contact Us</VCardTitle>
          <VCardText>
            <VForm ref="formRef" v-model="formValid" @submit.prevent="handleSubmit">
              <VTextField
                v-model="formData.name"
                label="Name"
                required
                :rules="validationRules.name"
                :error-messages="errors.name"
                variant="outlined"
                density="comfortable"
              />
              <VTextField
                v-model="formData.email"
                label="Email"
                required
                type="email"
                :rules="validationRules.email"
                :error-messages="errors.email"
                variant="outlined"
                density="comfortable"
              />
              <VTextarea
                v-model="formData.message"
                label="Message"
                required
                :rules="validationRules.message"
                :error-messages="errors.message"
                variant="outlined"
                density="comfortable"
                rows="4"
                auto-grow
              />
              
              <!-- Accessibility-friendly alerts -->
              <div role="alert" aria-live="assertive">
                <VAlert 
                  v-if="alerts.error" 
                  type="error" 
                  class="mt-2" 
                  closable 
                  @click:close="clearError"
                >
                  {{ alerts.error }}
                </VAlert>
                <VAlert 
                  v-if="alerts.success" 
                  type="success" 
                  class="mt-2" 
                  closable 
                  @click:close="clearSuccess"
                >
                  {{ alerts.success }}
                </VAlert>
              </div>
              
              <VBtn
                type="submit"
                color="primary"
                :disabled="!isFormValid || isSubmitting"
                :loading="isSubmitting"
                block
                size="large"
                class="mt-4"
              >
                <template #prepend>
                  <VIcon>mdi-send</VIcon>
                </template>
                Send Message
              </VBtn>
            </VForm>
          </VCardText>
        </VCard>
      </div>
      
      <!-- Back Side: Thank You / Socials -->
      <div class="flip-card-back">
        <VCard elevation="4" class="pa-4 text-center">
          <VCardTitle>Thank You!</VCardTitle>
          <VCardText>
            <div class="text-h6 mb-4">We'll get back to you soon.</div>
            
            <!-- Social media links with proper accessibility -->
            <div class="social-links mb-4">
              <VBtn
                v-for="item in socialWithIcons"
                :key="item.name"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`Visit our ${item.name} page`"
                variant="text"
                icon
                size="large"
                class="mx-1"
              >
                <FontAwesomeIcon 
                  :icon="item.iconObj" 
                  :style="{ color: item.color || 'rgb(var(--v-theme-primary))', fontSize: '1.5rem' }" 
                />
              </VBtn>
            </div>
            
            <VBtn
              color="primary"
              variant="outlined"
              @click="resetForm"
            >
              <template #prepend>
                <VIcon>mdi-arrow-left</VIcon>
              </template>
              Send Another Message
            </VBtn>
          </VCardText>
        </VCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick, watch } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VForm } from 'vuetify/components'

// Types
interface SocialItem {
  name: string
  url: string
  icon: string
  color?: string
  aria?: string
}

interface ContactInfo {
  social: SocialItem[]
}

// Composables with proper typing
const { $supabase } = useNuxtApp()
const supabase = $supabase as SupabaseClient
const contact = useContactInfo() as ContactInfo

// Icon mapping for social media
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => 
  contact.social.map((item: SocialItem) => ({
    ...item,
    iconObj: iconMap[item.icon as keyof typeof iconMap]
  }))
)

// Form state using reactive for better performance
const formData = reactive({
  name: '',
  email: '',
  message: ''
})

const formState = reactive({
  valid: false,
  submitting: false,
  flipped: false
})

const alerts = reactive({
  error: '',
  success: ''
})

const errors = reactive({
  name: [] as string[],
  email: [] as string[],
  message: [] as string[]
})

// Form reference with proper typing
const formRef = ref<VForm>()

// Validation rules using computed for reactivity
const validationRules = computed(() => ({
  name: [
    (v: string) => !!v?.trim() || 'Name is required',
    (v: string) => v?.trim().length >= 2 || 'Name must be at least 2 characters',
    (v: string) => v?.trim().length <= 50 || 'Name must be less than 50 characters'
  ],
  email: [
    (v: string) => !!v?.trim() || 'Email is required',
    (v: string) => {
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return pattern.test(v?.trim()) || 'Please enter a valid email address'
    }
  ],
  message: [
    (v: string) => !!v?.trim() || 'Message is required',
    (v: string) => v?.trim().length >= 10 || 'Message must be at least 10 characters',
    (v: string) => v?.trim().length <= 1000 || 'Message must be less than 1000 characters'
  ]
}))

// Computed properties for better reactivity
const isFormValid = computed(() => {
  return formState.valid && 
         formData.name.trim() && 
         formData.email.trim() && 
         formData.message.trim()
})

const isSubmitting = computed(() => formState.submitting)
const isFlipped = computed(() => formState.flipped)

// Clear functions
const clearError = () => {
  alerts.error = ''
}

const clearSuccess = () => {
  alerts.success = ''
}

const clearForm = () => {
  formData.name = ''
  formData.email = ''
  formData.message = ''
  Object.keys(errors).forEach(key => {
    const errorKey = key as keyof typeof errors
    errors[errorKey] = []
  })
}

// Reset form and flip state
const resetForm = () => {
  clearForm()
  clearError()
  clearSuccess()
  formState.flipped = false
  nextTick(() => {
    formRef.value?.resetValidation()
  })
}

// Submit handler with improved error handling and user feedback
const handleSubmit = async () => {
  try {
    // Clear previous alerts
    clearError()
    clearSuccess()
    formState.submitting = true

    // Validate form
    if (!formRef.value) {
      alerts.error = 'Form validation failed. Please try again.'
      return
    }

    const { valid } = await formRef.value.validate()
    if (!valid) {
      alerts.error = 'Please fix the errors above and try again.'
      return
    }

    // Prepare data
    const submissionData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      message: formData.message.trim(),
      created_at: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ip_address: null // Will be handled by RLS if needed
    }

    // Submit to Supabase
    const { error } = await supabase
      .from('contact_messages')
      .insert([submissionData])

    if (error) {
      console.error('Contact form submission error:', error)
      alerts.error = 'Failed to send message. Please try again later.'
      return
    }

    // Success feedback
    alerts.success = 'Message sent successfully!'
    
    // Flip card after short delay
    setTimeout(async () => {
      formState.flipped = true
      clearSuccess()
      
      // Clear form after flip animation
      setTimeout(() => {
        clearForm()
      }, 500)
    }, 1500)

  } catch (error) {
    console.error('Contact form error:', error)
    alerts.error = 'An unexpected error occurred. Please try again.'
  } finally {
    formState.submitting = false
  }
}

// Watch for field changes to provide real-time validation feedback
watch(formData, () => {
  if (formRef.value) {
    formRef.value.validate()
  }
}, { deep: true })
</script>

<style scoped>
/* Modern CSS with Vue 3 and Vuetify 3 best practices */
.contact-flip-card {
  perspective: 1000px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  isolation: isolate; /* Create new stacking context */
}

.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  will-change: transform; /* Optimize for animations */
}

.flipped .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px; /* Modern border radius */
  overflow: hidden;
  /* GPU acceleration for better performance */
  transform: translateZ(0);
}

.flip-card-front {
  z-index: 2;
}

.flip-card-back {
  transform: rotateY(180deg);
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  .flip-card-inner {
    transition: none;
  }
}

/* Focus states for better accessibility */
.social-links .v-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Responsive design */
@media (max-width: 600px) {
  .contact-flip-card {
    max-width: 100%;
    margin: 0;
  }
}

/* Modern CSS custom properties for theming */
.flip-card-front,
.flip-card-back {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* Smooth transitions for better UX */
.v-alert {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Loading state styling */
.v-btn[loading] {
  pointer-events: none;
}
</style>
