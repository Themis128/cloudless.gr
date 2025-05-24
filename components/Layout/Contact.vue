<template>
  <div class="contact-container">
    <div class="contact-content">
      <h1 class="contact-title" id="contact-form-heading">Contact Us</h1>
      <p class="contact-subtitle">Have a question or want to work with us? Get in touch!</p>      <div v-if="isSubmitted" class="success-message" data-cy="success-message">
        <h3>Thank you for contacting us!</h3>
        <p>We've received your message and will get back to you as soon as possible.</p>
        <button @click="resetForm" class="reset-button">Send Another Message</button>
      </div>

      <form
        v-else
        class="contact-form"
        @submit.prevent="submitForm"
        aria-labelledby="contact-form-heading"
        novalidate
      >
        <div class="form-group">
          <label for="name">Full Name</label>          <input
            type="text"
            id="name"
            data-cy="input-name"
            v-model="form.name"
            placeholder="Enter your full name"
            class="form-input"
            :class="{ 'error-input': errors.name }"
            @blur="validateName"
            required
            aria-required="true"
            autocomplete="name"
            :aria-invalid="errors.name ? 'true' : 'false'"
            :aria-describedby="errors.name ? 'name-error' : undefined"
          />
          <p v-if="errors.name" class="error-message" id="name-error" data-cy="error-message">{{ errors.name }}</p>
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>          <input
            type="email"
            id="email"
            data-cy="input-email"
            v-model="form.email"
            placeholder="Enter your email address"
            class="form-input"
            :class="{ 'error-input': errors.email }"
            @blur="validateEmail"
            required
            aria-required="true"
            autocomplete="email"
            :aria-invalid="errors.email ? 'true' : 'false'"
            :aria-describedby="errors.email ? 'email-error' : undefined"
          />
          <p v-if="errors.email" class="error-message" id="email-error" data-cy="error-message">{{ errors.email }}</p>
        </div>

        <div class="form-group">
          <label for="subject">Subject</label>          <input
            type="text"
            id="subject"
            data-cy="input-subject"
            v-model="form.subject"
            placeholder="What's this about?"
            class="form-input"
            :class="{ 'error-input': errors.subject }"
            @blur="validateSubject"
            required
            aria-required="true"
            :aria-invalid="errors.subject ? 'true' : 'false'"
            :aria-describedby="errors.subject ? 'subject-error' : undefined"
          />
          <p v-if="errors.subject" class="error-message" id="subject-error" data-cy="error-message">{{ errors.subject }}</p>
        </div>

        <!-- Honeypot field - hidden from users but bots will fill it out -->
        <div class="honeypot-field" aria-hidden="true">
          <label for="website">Website</label>
          <input type="text" id="website" name="website" v-model="honeypotField" tabindex="-1" />
        </div>

        <div class="form-group">
          <label for="message">Message</label>          <textarea
            id="message"
            data-cy="input-message"
            rows="5"
            v-model="form.message"
            placeholder="Tell us what you need"
            class="form-textarea"
            :class="{ 'error-input': errors.message }"
            @blur="validateMessage"
            required
            aria-required="true"
            :aria-invalid="errors.message ? 'true' : 'false'"
            :aria-describedby="errors.message ? 'message-error' : undefined"
          ></textarea>
          <p v-if="errors.message" class="error-message" id="message-error" data-cy="error-message">{{ errors.message }}</p>
        </div>

        <p v-if="submitError" class="form-error" role="alert">
          {{ submitError }}
          <button
            v-if="submitError.includes('session')"
            @click="refreshCsrfToken"
            class="refresh-token-button"
            :disabled="isRefreshingToken"
            type="button"
          >
            {{ isRefreshingToken ? 'Refreshing...' : 'Refresh Session' }}
          </button>
        </p>

        <!-- Show token refreshing indicator -->
        <p v-else-if="isRefreshingToken" class="token-refreshing" aria-live="polite">
          <span class="refresh-spinner" aria-hidden="true"></span>
          Refreshing security token...
        </p>

        <!-- Rate limit warning when submissions are getting low -->
        <p v-if="hasLowSubmissionsRemaining" class="rate-limit-warning" role="status">
          Note: You have {{ rateLimitInfo.value.remaining }} submission{{
            rateLimitInfo.value.remaining === 1 ? '' : 's'
          }}
          remaining. Please wait before making additional requests.
        </p>

        <!-- Form submission status -->
        <div class="form-status" aria-live="polite">          <p v-if="formIsSaving" class="autosave-message" data-cy="autosave-indicator">
            <span class="autosave-icon" aria-hidden="true"></span>
            Saving your input...
          </p>
        </div>        <button
          type="submit"
          class="submit-button"
          data-cy="submit-button"
          :disabled="isSubmitting || isRateLimitExceeded"
          aria-busy="isSubmitting"
        >
          {{ isSubmitting ? 'Sending...' : 'Send Message' }}
        </button>
      </form>

      <div class="contact-info">
        <div class="info-item"><strong>Email:</strong> contact@cloudless.gr</div>
        <div class="info-item"><strong>Location:</strong> Athens, Greece</div>
        <div class="info-item"><strong>Working Hours:</strong> 9:00 AM - 6:00 PM EET</div>
      </div>
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
