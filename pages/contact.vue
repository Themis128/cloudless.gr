<template>
<<<<<<< HEAD
  <div class="contact-page">
    <div class="page-header">
      <h1 class="text-white">Contact Us</h1>
      <p class="subtitle text-white">
        Get in touch with our team for support, partnerships, or general inquiries
      </p>
    </div>

    <div class="content-container">
      <div class="contact-content">
        <div class="contact-info-section">
          <h2>Get in Touch</h2>
          <p class="section-description">
            We're here to help! Whether you have questions about our platform, need technical support, 
            or want to explore partnership opportunities, our team is ready to assist you.
          </p>
          
          <div class="contact-methods-grid">
            <div class="contact-method-card">
              <div class="method-icon">
                <v-icon size="48" color="primary">
                  mdi-email
                </v-icon>
              </div>
              <h3>Email Us</h3>
              <p>Send us a detailed message and we'll respond within 24 hours</p>
              <div class="contact-details">
                <div class="contact-item">
                  <span class="label">General Inquiries:</span>
                  <a href="mailto:hello@cloudless.gr" class="contact-link">hello@cloudless.gr</a>
                </div>
                <div class="contact-item">
                  <span class="label">Support:</span>
                  <a href="mailto:support@cloudless.gr" class="contact-link">support@cloudless.gr</a>
                </div>
                <div class="contact-item">
                  <span class="label">Partnerships:</span>
                  <a href="mailto:partnerships@cloudless.gr" class="contact-link">partnerships@cloudless.gr</a>
                </div>
              </div>
            </div>

            <div class="contact-method-card">
              <div class="method-icon">
                <v-icon size="48" color="success">
                  mdi-phone
                </v-icon>
              </div>
              <h3>Call Us</h3>
              <p>Speak directly with our team during business hours</p>
              <div class="contact-details">
                <div class="contact-item">
                  <span class="label">Main Office:</span>
                  <a href="tel:+1-555-123-4567" class="contact-link">+1 (555) 123-4567</a>
                </div>
                <div class="contact-item">
                  <span class="label">Support Line:</span>
                  <a href="tel:+1-555-987-6543" class="contact-link">+1 (555) 987-6543</a>
                </div>
                <div class="contact-item">
                  <span class="label">Hours:</span>
                  <span class="contact-text">Mon-Fri 9AM-6PM EST</span>
                </div>
              </div>
            </div>

            <div class="contact-method-card">
              <div class="method-icon">
                <v-icon size="48" color="warning">
                  mdi-calendar
                </v-icon>
              </div>
              <h3>Schedule a Meeting</h3>
              <p>Book a personalized consultation with our technical team</p>
              <div class="contact-details">
                <div class="contact-item">
                  <span class="label">Duration:</span>
                  <span class="contact-text">30-60 minutes</span>
                </div>
                <div class="contact-item">
                  <span class="label">Format:</span>
                  <span class="contact-text">Video call or in-person</span>
                </div>
                <div class="contact-item">
                  <span class="label">Topics:</span>
                  <span class="contact-text">Platform demo, technical consultation</span>
                </div>
              </div>
              <v-btn color="warning" variant="elevated" class="schedule-btn">
                Schedule Meeting
              </v-btn>
            </div>
          </div>
        </div>

        <div class="contact-form-section">
          <h2>Send us a Message</h2>
          <div class="form-container">
            <v-form ref="form" @submit.prevent="submitForm">
              <div class="form-row">
                <v-text-field
                  v-model="formData.firstName"
                  label="First Name"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                />
                <v-text-field
                  v-model="formData.lastName"
                  label="Last Name"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                />
              </div>

              <div class="form-row">
                <v-text-field
                  v-model="formData.email"
                  label="Email Address"
                  variant="outlined"
                  type="email"
                  :rules="[rules.required, rules.email]"
                  required
                />
                <v-text-field
                  v-model="formData.phone"
                  label="Phone Number (Optional)"
                  variant="outlined"
                />
              </div>

              <div class="form-row">
                <v-text-field
                  v-model="formData.company"
                  label="Company/Organization"
                  variant="outlined"
                />
                <v-select
                  v-model="formData.inquiryType"
                  :items="inquiryTypes"
                  label="Inquiry Type"
                  variant="outlined"
                  :rules="[rules.required]"
                  required
                />
              </div>

              <v-text-field
                v-model="formData.subject"
                label="Subject"
                variant="outlined"
                :rules="[rules.required]"
                required
              />

              <v-textarea
                v-model="formData.message"
                label="Message"
                variant="outlined"
                rows="6"
                :rules="[rules.required, rules.minLength]"
                required
                placeholder="Please provide details about your inquiry..."
              />

              <div class="form-actions">
                <v-btn
                  type="submit"
                  color="primary"
                  variant="elevated"
                  size="large"
                  :loading="isSubmitting"
                  class="submit-btn"
                >
                  Send Message
                </v-btn>
                <v-btn
                  type="button"
                  variant="outlined"
                  size="large"
                  class="reset-btn"
                  @click="resetForm"
                >
                  Reset Form
                </v-btn>
              </div>
            </v-form>
          </div>
        </div>

        <div class="office-section">
          <h2>Our Office</h2>
          <div class="office-grid">
            <div class="office-card">
              <div class="office-icon">
                <v-icon size="48" color="primary">
                  mdi-map-marker
                </v-icon>
              </div>
              <h3>Headquarters</h3>
              <div class="office-details">
                <p>Cloudless Wizard Inc.</p>
                <p>123 Innovation Drive</p>
                <p>Tech Valley, CA 94000</p>
                <p>United States</p>
              </div>
            </div>

            <div class="office-card">
              <div class="office-icon">
                <v-icon size="48" color="success">
                  mdi-clock
                </v-icon>
              </div>
              <h3>Business Hours</h3>
              <div class="office-details">
                <div class="hours-item">
                  <span>Monday - Friday:</span>
                  <span>9:00 AM - 6:00 PM EST</span>
                </div>
                <div class="hours-item">
                  <span>Saturday:</span>
                  <span>10:00 AM - 2:00 PM EST</span>
                </div>
                <div class="hours-item">
                  <span>Sunday:</span>
                  <span>Closed</span>
                </div>
                <div class="hours-item">
                  <span>Holidays:</span>
                  <span>Closed</span>
                </div>
              </div>
            </div>

            <div class="office-card">
              <div class="office-icon">
                <v-icon size="48" color="warning">
                  mdi-account-group
                </v-icon>
              </div>
              <h3>Connect With Us</h3>
              <div class="social-links">
                <v-btn
                  href="https://linkedin.com/company/cloudless-wizard"
                  target="_blank"
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-linkedin"
                  class="social-btn"
                >
                  LinkedIn
                </v-btn>
                <v-btn
                  href="https://twitter.com/cloudlesswizard"
                  target="_blank"
                  color="info"
                  variant="outlined"
                  prepend-icon="mdi-twitter"
                  class="social-btn"
                >
                  Twitter
                </v-btn>
                <v-btn
                  href="https://github.com/cloudless-wizard"
                  target="_blank"
                  color="dark"
                  variant="outlined"
                  prepend-icon="mdi-github"
                  class="social-btn"
                >
                  GitHub
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <div class="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div class="faq-grid">
            <div v-for="faq in contactFaqs" :key="faq.id" class="faq-item">
              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    {{ faq.question }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <p>{{ faq.answer }}</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
=======
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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
<<<<<<< HEAD
import { reactive, ref } from 'vue'

const form = ref()
const isSubmitting = ref(false)

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  inquiryType: string
  subject: string
  message: string
}

const formData = reactive<FormData>({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  inquiryType: '',
  subject: '',
  message: ''
})

const inquiryTypes = [
  'General Inquiry',
  'Technical Support',
  'Sales Question',
  'Partnership Opportunity',
  'Feature Request',
  'Bug Report',
  'Other'
]

const rules = {
  required: (value: string) => !!value || 'This field is required',
  email: (value: string) => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value) || 'Please enter a valid email address'
  },
  minLength: (value: string) => value.length >= 10 || 'Message must be at least 10 characters'
}

const contactFaqs = ref([
  {
    id: 1,
    question: 'What is the typical response time for inquiries?',
    answer: 'We aim to respond to all inquiries within 24 hours during business days. For urgent technical support, please call our support line for immediate assistance.'
  },
  {
    id: 2,
    question: 'Do you offer custom solutions for enterprise clients?',
    answer: 'Yes, we provide custom solutions and enterprise integrations. Please contact our partnerships team to discuss your specific requirements and schedule a consultation.'
  },
  {
    id: 3,
    question: 'Can I schedule a demo of the platform?',
    answer: 'Absolutely! We offer personalized platform demos. You can schedule a meeting through our calendar or contact us directly to arrange a demonstration tailored to your needs.'
  },
  {
    id: 4,
    question: 'What information should I include in my inquiry?',
    answer: 'Please include your name, company, specific questions or requirements, and any relevant context about your use case. This helps us provide more targeted and helpful responses.'
  }
])

const submitForm = async () => {
  const { valid } = await form.value.validate()
  
  if (valid) {
    isSubmitting.value = true
    
    // Simulate form submission
    setTimeout(() => {
      isSubmitting.value = false
      // Here you would typically send the data to your backend
      // Form submitted
      resetForm()
    }, 2000)
  }
}

const resetForm = () => {
  form.value.reset()
  Object.keys(formData).forEach(key => {
    formData[key as keyof FormData] = ''
  })
}
</script>

<style scoped>
.contact-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.contact-content {
  max-width: 1000px;
  margin: 0 auto;
}

.contact-info-section {
  margin-bottom: 4rem;
}

.contact-info-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
  text-align: center;
}

.section-description {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  text-align: center;
  margin-bottom: 3rem;
  line-height: 1.6;
}

.contact-methods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.contact-method-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.contact-method-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.method-icon {
  margin-bottom: 1rem;
}

.contact-method-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.contact-method-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.contact-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.contact-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
}

.contact-link {
  color: #667eea;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.3s ease;
}

.contact-link:hover {
  color: #5a6fd8;
  text-decoration: underline;
}

.contact-text {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.schedule-btn {
  width: 100%;
}

.contact-form-section {
  margin-bottom: 4rem;
}

.contact-form-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.form-container {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.submit-btn, .reset-btn {
  flex: 1;
  min-width: 150px;
}

.office-section {
  margin-bottom: 4rem;
}

.office-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.office-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.office-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.office-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.office-icon {
  margin-bottom: 1rem;
}

.office-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.office-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.office-details p {
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
  font-size: 0.9rem;
}

.hours-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.hours-item:last-child {
  border-bottom: none;
}

.hours-item span:first-child {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
}

.hours-item span:last-child {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.social-links {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.social-btn {
  width: 100%;
}

.faq-section {
  margin-bottom: 2rem;
}

.faq-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.faq-grid {
  display: grid;
  gap: 1rem;
}

.faq-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .contact-page {
    padding: 1rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .contact-methods-grid {
    grid-template-columns: 1fr;
  }
  
  .office-grid {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 
=======
import { computed } from 'vue';
import { useContactUs } from '~/composables/useContactUs';
import { definePageMeta } from '#imports'

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
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
