<template>
  <div>
    <v-container class="contact-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4">
            Contact Us
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Get in touch with our team for support, partnerships, or general inquiries
          </p>
        </v-col>
      </v-row>

      <!-- Contact Methods -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h4 mb-4">Get in Touch</h2>
            <p class="text-body-1 text-medium-emphasis">
              We're here to help! Whether you have questions about our platform,
              need technical support, or want to explore partnership
              opportunities, our team is ready to assist you.
            </p>
          </div>

          <v-row>
            <v-col cols="12" md="4">
              <ContactMethodCard
                icon="mdi-email"
                title="Email Us"
                description="Send us a detailed message and we'll respond within 24 hours"
                color="primary"
                :contact-info="emailContacts"
              />
            </v-col>

            <v-col cols="12" md="4">
              <ContactMethodCard
                icon="mdi-phone"
                title="Call Us"
                description="Speak directly with our team during business hours"
                color="success"
                :contact-info="phoneContacts"
              />
            </v-col>

            <v-col cols="12" md="4">
              <ContactMethodCard
                icon="mdi-calendar"
                title="Schedule a Meeting"
                description="Book a personalized consultation with our technical team"
                color="warning"
                :contact-info="meetingInfo"
              />
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- Contact Form -->
      <v-row>
        <v-col cols="12" lg="8" class="mx-auto">
          <v-card class="contact-form-card" elevation="4">
            <v-card-title class="text-h5 mb-6">
              Send us a Message
            </v-card-title>
            
            <v-form @submit.prevent="submitForm" ref="formRef">
              <v-card-text class="pa-6">
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.name"
                      label="Full Name"
                      variant="outlined"
                      required
                      :rules="[v => !!v || 'Name is required']"
                      :disabled="submitting"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="form.email"
                      label="Email Address"
                      type="email"
                      variant="outlined"
                      required
                      :rules="[
                        v => !!v || 'Email is required',
                        v => /.+@.+\..+/.test(v) || 'Email must be valid',
                      ]"
                      :disabled="submitting"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-text-field
                      v-model="form.subject"
                      label="Subject"
                      variant="outlined"
                      required
                      :rules="[v => !!v || 'Subject is required']"
                      :disabled="submitting"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-textarea
                      v-model="form.message"
                      label="Message"
                      variant="outlined"
                      rows="6"
                      required
                      :rules="[v => !!v || 'Message is required']"
                      :disabled="submitting"
                    />
                  </v-col>
                  <v-col cols="12" class="text-center">
                    <v-btn
                      type="submit"
                      color="primary"
                      size="large"
                      :loading="submitting"
                      :disabled="submitting"
                      :ripple="false"
                    >
                      <v-icon start>mdi-send</v-icon>
                      Send Message
                    </v-btn>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-form>
          </v-card>
        </v-col>
      </v-row>

      <!-- FAQ Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h4 mb-4">Frequently Asked Questions</h2>
            <p class="text-body-1 text-medium-emphasis">
              Find quick answers to common questions
            </p>
          </div>

          <v-row>
            <v-col 
              v-for="faq in contactFaqs" 
              :key="faq.id"
              cols="12" 
              md="6"
            >
              <FAQCard :faq="faq" />
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import ContactMethodCard from '~/components/ui/ContactMethodCard.vue'
import FAQCard from '~/components/ui/FAQCard.vue'

// Types
interface ContactInfo {
  label: string
  value: string
  link?: string
}

interface FAQ {
  id: number
  question: string
  answer: string
}

// Composables
const notificationsStore = useNotificationsStore()

// Form ref
const formRef = ref()

// Form data
const form = ref({
  name: '',
  email: '',
  subject: '',
  message: '',
})

const submitting = ref(false)

// Contact information
const emailContacts: ContactInfo[] = [
  {
    label: 'General Inquiries',
    value: 'hello@cloudless.gr',
    link: 'mailto:hello@cloudless.gr'
  },
  {
    label: 'Support',
    value: 'support@cloudless.gr',
    link: 'mailto:support@cloudless.gr'
  },
  {
    label: 'Partnerships',
    value: 'partnerships@cloudless.gr',
    link: 'mailto:partnerships@cloudless.gr'
  }
]

const phoneContacts: ContactInfo[] = [
  {
    label: 'Main Office',
    value: '+1 (555) 123-4567',
    link: 'tel:+1-555-123-4567'
  },
  {
    label: 'Support Line',
    value: '+1 (555) 987-6543',
    link: 'tel:+1-555-987-6543'
  },
  {
    label: 'Hours',
    value: 'Mon-Fri 9AM-6PM EST'
  }
]

const meetingInfo: ContactInfo[] = [
  {
    label: 'Duration',
    value: '30-60 minutes'
  },
  {
    label: 'Format',
    value: 'Video call or in-person'
  },
  {
    label: 'Topics',
    value: 'Platform demo, technical consultation'
  }
]

// FAQ data
const contactFaqs: FAQ[] = [
  {
    id: 1,
    question: 'What services does Cloudless Wizard offer?',
    answer:
      'We provide comprehensive AI and machine learning solutions including custom model development, data pipeline creation, bot building, and deployment services for businesses of all sizes.',
  },
  {
    id: 2,
    question: 'How quickly can you respond to support requests?',
    answer:
      'We typically respond to support requests within 24 hours during business days. For urgent issues, please call our support line for immediate assistance.',
  },
  {
    id: 3,
    question: 'Do you offer custom development services?',
    answer:
      'Yes, we specialize in custom AI and ML solutions tailored to your specific business needs. Contact us to discuss your project requirements.',
  },
  {
    id: 4,
    question: 'What are your pricing models?',
    answer:
      'We offer flexible pricing including subscription plans, project-based pricing, and custom enterprise solutions. Contact us for a personalized quote.',
  },
  {
    id: 5,
    question: 'Do you provide training and documentation?',
    answer:
      'Yes, we provide comprehensive training, documentation, and ongoing support to ensure your team can effectively use our solutions.',
  },
  {
    id: 6,
    question: 'What is your response time for urgent issues?',
    answer:
      'For urgent issues, we provide immediate support through our dedicated support line. Critical issues are typically resolved within 4 hours.',
  }
]

// Methods
const submitForm = async () => {
  const { valid } = await formRef.value.validate()
  
  if (!valid) {
    notificationsStore.error('Validation Error', 'Please fill in all required fields correctly')
    return
  }

  submitting.value = true

  try {
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Reset form
    form.value = {
      name: '',
      email: '',
      subject: '',
      message: '',
    }

    // Reset form validation
    formRef.value.resetValidation()

    // Show success message
    notificationsStore.success('Message Sent', 'Thank you for your message. We\'ll get back to you within 24 hours.')
  } catch (error) {
    console.error('Error submitting form:', error)
    notificationsStore.error('Error', 'Failed to send message. Please try again.')
  } finally {
    submitting.value = false
  }
}

// Meta
definePageMeta({
  title: 'Contact Us - Cloudless Wizard',
  description: 'Get in touch with Cloudless Wizard for support, partnerships, or general inquiries. Our team is ready to help with your AI development needs.',
  layout: 'default'
})
</script>

<style scoped>
.contact-page {
  max-width: 1200px;
  margin: 0 auto;
}

.contact-form-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.contact-form-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Responsive improvements */
@media (max-width: 600px) {
  .contact-page {
    padding: 0 16px;
  }
}

/* Accessibility improvements */
:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

/* Smooth transitions */
.v-card {
  transition: all 0.3s ease-in-out;
}
</style>
