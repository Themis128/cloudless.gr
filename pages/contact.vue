<template>
  <div class="contact-container">
    <div class="contact-header">
      <h1>Get in Touch</h1>
      <p class="header-description">
        Ready to start your next project? We'd love to hear from you. 
        Send us a message and we'll respond as soon as possible.
      </p>
    </div>

    <div class="contact-content">
      <div class="contact-form-section">
        <div class="form-container">
          <h2>Send us a Message</h2>
          
          <div v-if="contactForm.isSuccess" class="success-message">
            <div class="success-icon">✅</div>
            <h3>Message Sent Successfully!</h3>
            <p>Thank you for reaching out. We'll get back to you within 24 hours.</p>
            <p v-if="contactForm.submissionId" class="submission-id">
              Reference ID: #{{ contactForm.submissionId }}
            </p>
          </div>

          <form v-else @submit.prevent="handleSubmit" class="contact-form">
            <div v-if="contactForm.submitError" class="error-message">
              {{ contactForm.submitError }}
            </div>

            <div class="form-group">
              <label for="name">Full Name *</label>
              <input
                type="text"
                id="name"
                v-model="contactForm.form.name"
                @blur="contactForm.validateName"
                required
                placeholder="Enter your full name"
                :class="{ 'error': contactForm.errors.name }"
              />
              <p v-if="contactForm.errors.name" class="field-error">{{ contactForm.errors.name }}</p>
            </div>

            <div class="form-group">
              <label for="email">Email Address *</label>
              <input
                type="email"
                id="email"
                v-model="contactForm.form.email"
                @blur="contactForm.validateEmail"
                required
                placeholder="Enter your email address"
                :class="{ 'error': contactForm.errors.email }"
              />
              <p v-if="contactForm.errors.email" class="field-error">{{ contactForm.errors.email }}</p>
            </div>

            <div class="form-group">
              <label for="subject">Subject *</label>
              <input
                type="text"
                id="subject"
                v-model="contactForm.form.subject"
                @blur="contactForm.validateSubject"
                required
                placeholder="What's this about?"
                :class="{ 'error': contactForm.errors.subject }"
              />
              <p v-if="contactForm.errors.subject" class="field-error">{{ contactForm.errors.subject }}</p>
            </div>

            <div class="form-group">
              <label for="message">Message *</label>
              <textarea
                id="message"
                v-model="contactForm.form.message"
                @blur="contactForm.validateMessage"
                required
                rows="5"
                placeholder="Tell us about your project or how we can help..."
                :class="{ 'error': contactForm.errors.message }"
              ></textarea>
              <p v-if="contactForm.errors.message" class="field-error">{{ contactForm.errors.message }}</p>
            </div>

            <!-- Honeypot field for spam protection -->
            <input 
              type="text" 
              name="website" 
              v-model="contactForm.form.website" 
              style="display: none;" 
              tabindex="-1" 
              autocomplete="off"
            />

            <button 
              type="submit" 
              class="submit-button" 
              :disabled="contactForm.isSubmitting || !isFormValid"
            >
              {{ contactForm.isSubmitting ? 'Sending...' : 'Send Message' }}
            </button>

            <div v-if="contactForm.rateLimitInfo?.remaining !== undefined" class="rate-limit-info">
              <p>Submissions remaining: {{ contactForm.rateLimitInfo.remaining }}/5 per hour</p>
            </div>
          </form>
        </div>
      </div>

      <div class="contact-info-section">
        <div class="info-container">
          <h2>Contact Information</h2>
          
          <div class="contact-methods">
            <div class="contact-method">
              <div class="method-icon">📧</div>
              <div class="method-content">
                <h3>Email</h3>
                <p>hello@cloudless.gr</p>
                <span class="method-note">We respond within 24 hours</span>
              </div>
            </div>

            <div class="contact-method">
              <div class="method-icon">💼</div>
              <div class="method-content">
                <h3>Business Inquiries</h3>
                <p>business@cloudless.gr</p>
                <span class="method-note">For partnership and collaboration</span>
              </div>
            </div>

            <div class="contact-method">
              <div class="method-icon">🛠️</div>
              <div class="method-content">
                <h3>Technical Support</h3>
                <p>support@cloudless.gr</p>
                <span class="method-note">For technical assistance</span>
              </div>
            </div>
          </div>

          <div class="additional-info">
            <h3>Working Hours</h3>
            <p>Monday - Friday: 9:00 AM - 6:00 PM (GMT+2)</p>
            <p>Weekend: Emergency support only</p>
          </div>

          <div class="response-time">
            <h3>Response Time</h3>
            <p>• Email inquiries: Within 24 hours</p>
            <p>• Project proposals: Within 48 hours</p>
            <p>• Technical support: Within 12 hours</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useContactUs } from '~/composables/useContactUs';

// Use the contact form composable
const contactForm = useContactUs();

// Computed property to check if form is valid
const isFormValid = computed(() => {
  return contactForm.form.name && 
         contactForm.form.email && 
         contactForm.form.subject && 
         contactForm.form.message &&
         !contactForm.errors.name &&
         !contactForm.errors.email &&
         !contactForm.errors.subject &&
         !contactForm.errors.message;
});

// Handle form submission
const handleSubmit = async () => {
  if (contactForm.validateForm()) {
    await contactForm.submitContactForm();
  }
};

// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.contact-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.contact-header {
  text-align: center;
  margin-bottom: 4rem;
}

.contact-header h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header-description {
  font-size: 1.2rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.contact-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

.form-container,
.info-container {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2.5rem;
}

.form-container h2,
.info-container h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 2rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input.error,
.form-group textarea.error {
  border-color: #dc2626;
}

.field-error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.success-message {
  text-align: center;
  padding: 2rem;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.success-message h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #059669;
  margin-bottom: 0.5rem;
}

.success-message p {
  color: #64748b;
  margin-bottom: 0.5rem;
}

.submission-id {
  font-family: monospace;
  background-color: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.submit-button {
  background-color: #1e40af;
  color: white;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 1rem;
}

.submit-button:hover:not(:disabled) {
  background-color: #1e3a8a;
}

.submit-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.rate-limit-info {
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.contact-method {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.method-icon {
  font-size: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eff6ff;
  border-radius: 50%;
  flex-shrink: 0;
}

.method-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.25rem;
}

.method-content p {
  color: #374151;
  margin-bottom: 0.25rem;
}

.method-note {
  font-size: 0.875rem;
  color: #64748b;
}

.additional-info,
.response-time {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.additional-info h3,
.response-time h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.75rem;
}

.additional-info p,
.response-time p {
  color: #64748b;
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .contact-header h1 {
    font-size: 2.5rem;
  }
  
  .contact-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .form-container,
  .info-container {
    padding: 2rem 1.5rem;
  }
}
</style>
