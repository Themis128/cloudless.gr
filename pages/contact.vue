<template>
  <div class="contact-page">
    <div class="page-header">
      <h1>Contact Us</h1>
      <p class="subtitle">Get in touch with our team. We'd love to hear from you!</p>
    </div>

    <div class="content-grid">
      <div class="contact-info-section">
        <h2>Get in Touch</h2>
        <p>
          Have questions about our platform? Need help with your implementation? 
          Want to discuss a partnership? We're here to help!
        </p>
        
        <div class="contact-methods">
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">mdi-email</v-icon>
            </div>
            <div class="method-content">
              <h3>Email Us</h3>
              <p>hello@cloudlesswizard.com</p>
              <span class="response-time">We'll respond within 24 hours</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">mdi-chat</v-icon>
            </div>
            <div class="method-content">
              <h3>Live Chat</h3>
              <p>Available during business hours</p>
              <span class="response-time">Instant response</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">mdi-phone</v-icon>
            </div>
            <div class="method-content">
              <h3>Call Us</h3>
              <p>+1 (555) 123-4567</p>
              <span class="response-time">Mon-Fri, 9AM-6PM EST</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">mdi-map-marker</v-icon>
            </div>
            <div class="method-content">
              <h3>Visit Us</h3>
              <p>123 Innovation Drive<br>San Francisco, CA 94105</p>
              <span class="response-time">By appointment only</span>
            </div>
          </div>
        </div>
      </div>

      <div class="contact-form-section">
        <h2>Send us a Message</h2>
        <div class="contact-form">
          <div class="form-row">
            <v-text-field
              v-model="form.firstName"
              label="First Name"
              variant="outlined"
              required
              class="form-field"
            />
            <v-text-field
              v-model="form.lastName"
              label="Last Name"
              variant="outlined"
              required
              class="form-field"
            />
          </div>
          
          <v-text-field
            v-model="form.email"
            label="Email Address"
            variant="outlined"
            type="email"
            required
            class="form-field"
          />
          
          <v-text-field
            v-model="form.company"
            label="Company (Optional)"
            variant="outlined"
            class="form-field"
          />
          
          <v-select
            v-model="form.subject"
            :items="subjectOptions"
            label="Subject"
            variant="outlined"
            required
            class="form-field"
          />
          
          <v-textarea
            v-model="form.message"
            label="Message"
            variant="outlined"
            rows="6"
            required
            class="form-field"
          />
          
          <div class="form-actions">
            <v-btn 
              color="primary" 
              size="large" 
              class="submit-btn"
              :loading="isSubmitting"
              @click="submitForm"
            >
              <v-icon left>mdi-send</v-icon>
              Send Message
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <div class="faq-section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-grid">
        <div class="faq-item">
          <h3>How do I get started with Cloudless Wizard?</h3>
          <p>
            Getting started is easy! Simply sign up for a free account and follow our 
            step-by-step onboarding process. We'll guide you through creating your first 
            bot, model, or pipeline.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>What kind of support do you offer?</h3>
          <p>
            We offer comprehensive support including documentation, tutorials, live chat, 
            email support, and phone support for enterprise customers. Our team is here 
            to help you succeed.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>Can I integrate with my existing systems?</h3>
          <p>
            Absolutely! Cloudless Wizard is designed to integrate seamlessly with your 
            existing infrastructure. We support all major cloud providers and offer 
            extensive API documentation.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>What are your pricing plans?</h3>
          <p>
            We offer flexible pricing plans starting with a free tier for individual 
            developers. Our paid plans scale with your needs and include enterprise 
            features for larger organizations.
          </p>
        </div>
      </div>
    </div>

    <div class="office-section">
      <h2>Our Office</h2>
      <div class="office-card">
        <div class="office-info">
          <h3>San Francisco Headquarters</h3>
          <p>
            Located in the heart of San Francisco's tech district, our office is 
            designed for collaboration and innovation. We welcome visitors by appointment.
          </p>
          <div class="office-details">
            <div class="detail">
              <v-icon size="20" color="primary">mdi-map-marker</v-icon>
              <span>123 Innovation Drive, San Francisco, CA 94105</span>
            </div>
            <div class="detail">
              <v-icon size="20" color="primary">mdi-clock</v-icon>
              <span>Monday - Friday, 9:00 AM - 6:00 PM PST</span>
            </div>
            <div class="detail">
              <v-icon size="20" color="primary">mdi-phone</v-icon>
              <span>+1 (555) 123-4567</span>
            </div>
          </div>
        </div>
        <div class="office-map">
          <div class="map-placeholder">
            <v-icon size="64" color="primary">mdi-map</v-icon>
            <p>Interactive Map</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isSubmitting = ref(false)

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  company: '',
  subject: '',
  message: ''
})

const subjectOptions = [
  'General Inquiry',
  'Technical Support',
  'Sales Question',
  'Partnership',
  'Feature Request',
  'Bug Report',
  'Other'
]

const submitForm = async () => {
  isSubmitting.value = true
  
  // Simulate form submission
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Reset form
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    subject: '',
    message: ''
  }
  
  isSubmitting.value = false
  
  // Show success message (you can implement this with a toast notification)
  alert('Thank you for your message! We\'ll get back to you soon.')
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

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  margin-bottom: 4rem;
}

.contact-info-section,
.contact-form-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.contact-info-section h2,
.contact-form-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.contact-info-section p {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-method {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.method-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 12px;
  flex-shrink: 0;
}

.method-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.method-content p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 0.5rem;
}

.response-time {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.5);
  font-style: italic;
}

.contact-form {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  margin-bottom: 1.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 2rem;
}

.submit-btn {
  min-width: 200px;
}

.faq-section {
  margin-bottom: 4rem;
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
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 2rem;
}

.faq-item {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.faq-item h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.faq-item p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

.office-section {
  margin-bottom: 2rem;
}

.office-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.office-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 3rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.office-info h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.office-info p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.office-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: rgba(0, 0, 0, 0.7);
}

.office-map {
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 300px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.7);
}

.map-placeholder p {
  margin-top: 1rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .contact-page {
    padding: 1rem;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
  
  .subtitle {
    font-size: 1rem;
  }
  
  .content-grid {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .faq-grid {
    grid-template-columns: 1fr;
  }
  
  .office-card {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 2rem;
  }
  
  .map-placeholder {
    height: 200px;
  }
}
</style> 