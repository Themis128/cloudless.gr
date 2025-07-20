<template>
  <div class="contact-page">
    <div class="page-header">
      <h1>Contact Us</h1>
      <p class="subtitle">
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
      console.log('Form submitted:', formData)
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