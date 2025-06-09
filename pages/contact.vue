<template>
  <v-container class="py-8" max-width="lg">
    <v-row>
      <v-col cols="12" class="text-center mb-8">
        <h1 class="text-h2 font-weight-bold text-primary mb-2">Get in Touch</h1>
        <div class="text-subtitle-1 mx-auto" style="max-width: 600px">
          Ready to start your next project? We'd love to hear from you. Send us a message and we'll
          respond as soon as possible.
        </div>
      </v-col>
    </v-row>
    <v-row align="start" justify="center" class="gap-8">
      <v-col cols="12" md="6">
        <v-card elevation="2" class="pa-6">
          <h2 class="text-h5 font-weight-medium text-primary mb-4">Send us a Message</h2>
          <v-alert
            v-if="contactForm.isSuccess"
            type="success"
            class="mb-4"
            border="start"
            variant="tonal"
          >
            <div class="d-flex flex-column align-center">
              <div class="success-icon">✅</div>
              <h3>Message Sent Successfully!</h3>
              <p>Thank you for reaching out. We'll get back to you within 24 hours.</p>
              <p v-if="contactForm.submissionId" class="submission-id">
                Reference ID: #{{ contactForm.submissionId }}
              </p>
            </div>
          </v-alert>

          <v-form v-else @submit.prevent="handleSubmit" :disabled="contactForm.isSubmitting">
            <v-alert
              v-if="contactForm.error"
              type="error"
              class="mb-4"
              border="start"
              variant="tonal"
            >
              {{ contactForm.error }}
            </v-alert>

            <v-text-field
              v-model="contactForm.form.name"
              label="Full Name *"
              :error-messages="contactForm.errors.name"
              @blur="contactForm.validateName"
              required
              placeholder="Enter your full name"
              prepend-inner-icon="mdi-account"
              class="mb-3"
            />

            <v-text-field
              v-model="contactForm.form.email"
              label="Email Address *"
              :error-messages="contactForm.errors.email"
              @blur="contactForm.validateEmail"
              required
              placeholder="Enter your email address"
              prepend-inner-icon="mdi-email"
              class="mb-3"
            />

            <v-text-field
              v-model="contactForm.form.subject"
              label="Subject *"
              :error-messages="contactForm.errors.subject"
              @blur="contactForm.validateSubject"
              required
              placeholder="What's this about?"
              prepend-inner-icon="mdi-format-title"
              class="mb-3"
            />

            <v-textarea
              v-model="contactForm.form.message"
              label="Message *"
              :error-messages="contactForm.errors.message"
              @blur="contactForm.validateMessage"
              required
              rows="5"
              placeholder="Tell us about your project or how we can help..."
              prepend-inner-icon="mdi-comment-text"
              class="mb-3"
            />

            <!-- Honeypot field for spam protection -->
            <v-text-field
              v-model="honeypot"
              name="website"
              style="display: none"
              tabindex="-1"
              autocomplete="off"
            />

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="contactForm.isSubmitting"
              :disabled="contactForm.isSubmitting || !contactForm.isValid"
              class="mt-4"
            >
              {{ contactForm.isSubmitting ? 'Sending...' : 'Send Message' }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card elevation="2" class="pa-6">
          <h2 class="text-h5 font-weight-medium text-primary mb-4">Contact Information</h2>

          <v-list class="pa-0">
            <v-list-item class="px-0 py-4">
              <template v-slot:prepend>
                <v-avatar color="primary" variant="tonal" rounded class="mr-3">
                  <v-icon>mdi-email</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium">Email</v-list-item-title>
              <v-list-item-subtitle>hello@cloudless.gr</v-list-item-subtitle>
              <v-list-item-subtitle class="text-grey"
                >We respond within 24 hours</v-list-item-subtitle
              >
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="px-0 py-4">
              <template v-slot:prepend>
                <v-avatar color="primary" variant="tonal" rounded class="mr-3">
                  <v-icon>mdi-briefcase</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium">Business Inquiries</v-list-item-title>
              <v-list-item-subtitle>business@cloudless.gr</v-list-item-subtitle>
              <v-list-item-subtitle class="text-grey"
                >For partnership and collaboration</v-list-item-subtitle
              >
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item class="px-0 py-4">
              <template v-slot:prepend>
                <v-avatar color="primary" variant="tonal" rounded class="mr-3">
                  <v-icon>mdi-tools</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-medium">Technical Support</v-list-item-title>
              <v-list-item-subtitle>support@cloudless.gr</v-list-item-subtitle>
              <v-list-item-subtitle class="text-grey"
                >For technical assistance</v-list-item-subtitle
              >
            </v-list-item>
          </v-list>

          <v-divider class="my-4"></v-divider>

          <h3 class="text-h6 font-weight-medium text-primary mb-2">Working Hours</h3>
          <v-list-item density="compact" class="px-0">
            <v-list-item-subtitle>Monday - Friday: 9:00 AM - 6:00 PM (GMT+2)</v-list-item-subtitle>
          </v-list-item>
          <v-list-item density="compact" class="px-0 mt-1">
            <v-list-item-subtitle>Weekend: Emergency support only</v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-4"></v-divider>

          <h3 class="text-h6 font-weight-medium text-primary mb-2">Response Time</h3>
          <v-list class="pa-0">
            <v-list-item density="compact" class="px-0">
              <v-list-item-subtitle>• Email inquiries: Within 24 hours</v-list-item-subtitle>
            </v-list-item>
            <v-list-item density="compact" class="px-0">
              <v-list-item-subtitle>• Project proposals: Within 48 hours</v-list-item-subtitle>
            </v-list-item>
            <v-list-item density="compact" class="px-0">
              <v-list-item-subtitle>• Technical support: Within 12 hours</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useContactUs } from '~/composables/useContactUs';

  // Use the contact form composable
  const contactForm = useContactUs();

  // Honeypot field for spam protection
  const honeypot = ref('');

  // Handle form submission
  const handleSubmit = async () => {
    // If honeypot is filled, treat as spam and do nothing
    if (honeypot.value) return;
    await contactForm.submitForm();
  };
</script>

<style scoped>
  /* Any remaining custom styles can be added here if needed */
</style>
