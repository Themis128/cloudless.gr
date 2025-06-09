<template>
  <v-container class="contact-container pa-4">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card class="pa-5 elevation-3">
          <v-card-title class="text-h4 text-center" id="contact-form-heading">Contact Us</v-card-title>
          <v-card-subtitle class="text-center pb-4">Have a question or want to work with us? Get in touch!</v-card-subtitle>

          <!-- Success Message after submission -->
          <v-alert
            v-if="isSubmitted"
            type="success"
            data-cy="success-message"
            variant="tonal"
            prominent
            border="start"
            closable
          >
            <v-alert-title>Thank you for contacting us!</v-alert-title>
            <p>We've received your message and will get back to you as soon as possible.</p>
            <template v-slot:append>
              <v-btn color="success" variant="tonal" @click="resetForm">Send Another Message</v-btn>
            </template>
          </v-alert>

          <!-- Contact Form -->
          <v-form
            v-else
            @submit.prevent="submitForm"
            aria-labelledby="contact-form-heading"
            v-model="isFormValid"
            validate-on="blur"
          >
            <!-- Full Name Field -->
            <v-text-field
              v-model="form.name"
              label="Full Name"
              placeholder="Enter your full name"
              id="name"
              data-cy="input-name"
              :error-messages="errors.name"
              @blur="validateName"
              required
              autocomplete="name"
              variant="outlined"
              prepend-inner-icon="mdi-account"
              class="mb-3"
            ></v-text-field>

            <!-- Email Field -->
            <v-text-field
              v-model="form.email"
              label="Email Address"
              placeholder="Enter your email address"
              type="email"
              id="email"
              data-cy="input-email"
              :error-messages="errors.email"
              @blur="validateEmail"
              required
              autocomplete="email"
              variant="outlined"
              prepend-inner-icon="mdi-email"
              class="mb-3"
            ></v-text-field>

            <!-- Subject Field -->
            <v-text-field
              v-model="form.subject"
              label="Subject"
              placeholder="What's this about?"
              id="subject"
              data-cy="input-subject"
              :error-messages="errors.subject"
              @blur="validateSubject"
              required
              variant="outlined"
              prepend-inner-icon="mdi-format-title"
              class="mb-3"
            ></v-text-field>

            <!-- Honeypot field - hidden from users but bots will fill it out -->
            <div class="honeypot-field" aria-hidden="true" style="opacity: 0; position: absolute; top: -9999px; left: -9999px;">
              <label for="website">Website</label>
              <v-text-field id="website" name="website" v-model="honeypotField" tabindex="-1"></v-text-field>
            </div>

            <!-- Message Field -->
            <v-textarea
              v-model="form.message"
              label="Message"
              placeholder="Tell us what you need"
              id="message"
              data-cy="input-message"
              :error-messages="errors.message"
              @blur="validateMessage"
              required
              rows="5"
              variant="outlined"
              prepend-inner-icon="mdi-comment-text"
              class="mb-3"            ></v-textarea>

            <!-- Error Alert -->
            <v-alert
              v-if="submitError"
              type="error"
              variant="tonal"
              class="mb-4"
              role="alert"
            >
              {{ submitError }}
              <template v-if="submitError.includes('session')" v-slot:append>
                <v-btn
                  @click="refreshCsrfToken"
                  :disabled="isRefreshingToken"
                  :loading="isRefreshingToken"
                  variant="text"
                  color="error"
                >
                  Refresh Session
                </v-btn>
              </template>
            </v-alert>

            <!-- Token Refreshing Progress -->
            <v-progress-circular
              v-if="isRefreshingToken"
              indeterminate
              color="primary"
              class="mb-4 d-block mx-auto"
            ></v-progress-circular>

            <!-- Rate Limit Warning -->
            <v-alert
              v-if="hasLowSubmissionsRemaining"
              type="warning"
              variant="tonal"
              class="mb-4"
              role="status"
              density="compact"
            >
              Note: You have {{ rateLimitInfo.value.remaining }} submission{{
                rateLimitInfo.value.remaining === 1 ? '' : 's'
              }} remaining. Please wait before making additional requests.
            </v-alert>

            <!-- Form Status -->
            <v-slide-y-transition>
              <v-progress-linear
                v-if="formIsSaving"
                indeterminate
                color="primary"
                class="mb-4"
                data-cy="autosave-indicator"
              ></v-progress-linear>
            </v-slide-y-transition>

            <!-- Submit Button -->
            <v-btn
              type="submit"
              color="primary"
              block
              size="large"
              :loading="isSubmitting"
              :disabled="isSubmitting || isRateLimitExceeded"
              data-cy="submit-button"
              class="mt-4"
            >
              {{ isSubmitting ? 'Sending...' : 'Send Message' }}
            </v-btn>
          </v-form>

          <!-- Contact Info -->
          <v-divider class="my-6"></v-divider>
          <v-list lines="two" class="contact-info bg-transparent">
            <v-list-item prepend-icon="mdi-email">
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>contact@cloudless.gr</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-map-marker">
              <v-list-item-title>Location</v-list-item-title>
              <v-list-item-subtitle>Athens, Greece</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-clock-time-nine">
              <v-list-item-title>Working Hours</v-list-item-title>
              <v-list-item-subtitle>9:00 AM - 6:00 PM EET</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useContactUs } from '~/composables/useContactUs';

// Honeypot field for spam prevention
const honeypotField = ref('');
const formIsSaving = ref(false);
let autoSaveTimeout;

// Use our contact form composable
const {
  form,
  errors,
  isSubmitting,
  isSuccess: isSubmitted,
  error: submitError,
  rateLimitInfo,
  isRefreshingToken,
  submitForm: originalSubmitForm,
  resetForm,
  refreshCsrfToken,
} = useContactUs();

// Create a computed property that safely checks rate limit information
const hasLowSubmissionsRemaining = computed(() => {
  return (
    rateLimitInfo.value &&
    typeof rateLimitInfo.value.remaining === 'number' &&
    rateLimitInfo.value.remaining <= 2
  );
});

// Check if rate limit is exceeded
const isRateLimitExceeded = computed(() => {
  return rateLimitInfo.value && rateLimitInfo.value.exceeded === true;
});

// Wrap the submit function to check the honeypot field
const submitForm = async () => {
  // If honeypot field is filled, silently reject the submission
  if (honeypotField.value) {
    console.log('Spam submission detected and blocked');
    // Pretend to submit but don't actually do it
    isSubmitting.value = true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    isSubmitting.value = false;
    isSubmitted.value = true; // Show success message to avoid tipping off the bot
    return;
  }

  // Otherwise, proceed with the real submission
  return originalSubmitForm();
};

// Auto-save form data to localStorage
const saveFormToLocalStorage = () => {
  if (!process.client) return;

  formIsSaving.value = true;

  const formData = {
    name: form.name,
    email: form.email,
    subject: form.subject,
    message: form.message,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem('contact_form_draft', JSON.stringify(formData));
  } catch (e) {
    console.error('Failed to save form data:', e);
  }

  // Hide the saving indicator after a brief delay
  setTimeout(() => {
    formIsSaving.value = false;
  }, 800);
};

// Debounced auto-save
const debouncedSaveForm = () => {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(saveFormToLocalStorage, 1000);
};

// Load saved form data
const loadSavedFormData = () => {
  if (!process.client) return;

  try {
    const savedData = localStorage.getItem('contact_form_draft');
    if (savedData) {
      const parsedData = JSON.parse(savedData);

      // Only restore if data is less than 7 days old
      const isRecent = Date.now() - parsedData.timestamp < 7 * 24 * 60 * 60 * 1000;

      if (isRecent) {
        form.name = parsedData.name || '';
        form.email = parsedData.email || '';
        form.subject = parsedData.subject || '';
        form.message = parsedData.message || '';
      } else {
        // Clear old data
        localStorage.removeItem('contact_form_draft');
      }
    }
  } catch (e) {
    console.error('Failed to load saved form data:', e);
  }
};

// Clear saved form data after successful submission
const clearSavedFormData = () => {
  if (!process.client) return;
  localStorage.removeItem('contact_form_draft');
};

// Watch for form changes and save drafts
watch(() => [form.name, form.email, form.subject, form.message], debouncedSaveForm, { deep: true });

// Watch for successful submission and clear saved data
watch(isSubmitted, (newValue) => {
  if (newValue === true) {
    clearSavedFormData();
  }
});

// Load saved data on mount
onMounted(() => {
  loadSavedFormData();
});

// Clean up on component unmount
onBeforeUnmount(() => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
});
</script>

<style scoped>
.contact-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem 1rem;
  min-height: 80vh;
}

.contact-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 2.5rem;
  max-width: 650px;
  width: 100%;
}

.contact-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.5rem;
  text-align: center;
}

.contact-subtitle {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  text-align: center;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 1rem;
  font-weight: 500;
  color: #475569;
}

.form-input,
.form-textarea {
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* Honeypot field for spam prevention - hide it visually */
.honeypot-field {
  position: absolute;
  left: -9999px;
  opacity: 0;
  height: 0;
  width: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.error-input {
  border-color: #ef4444;
}

.error-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.error-message {
  font-size: 0.875rem;
  color: #ef4444;
  margin-top: 0.25rem;
}

.form-error {
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.rate-limit-warning {
  background-color: #feebc8;
  color: #dd6b20;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.success-message {
  background-color: #ecfdf5;
  color: #065f46;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.success-message h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.reset-button {
  background-color: #059669;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.625rem 1.25rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
  transition: background-color 0.2s;
}

.reset-button:hover {
  background-color: #047857;
}

.submit-button {
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  margin-top: 1rem;
  text-align: center;
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.submit-button:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.contact-info {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  font-size: 1rem;
  color: #475569;
}

.refresh-token-button {
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background-color 0.2s;
}

.refresh-token-button:hover {
  background-color: #2563eb;
}

.token-refreshing {
  background-color: #e6f2ff;
  color: #2563eb;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.refresh-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.form-status {
  min-height: 24px;
  margin-top: 0.5rem;
}

.autosave-message {
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.autosave-icon {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid rgba(100, 116, 139, 0.3);
  border-top-color: #64748b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .contact-content {
    padding: 1.5rem;
  }

  .contact-title {
    font-size: 1.75rem;
  }
}
</style>
