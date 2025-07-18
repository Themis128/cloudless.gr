<template>
  <div class="contact-page">
    <div class="page-header">
      <h1>Contact Us</h1>
      <p class="subtitle">
        Get in touch with our team. We'd love to hear from you!
      </p>
    </div>

    <div class="content-grid">
      <div class="contact-info-section">
        <h2>Get in Touch</h2>
        <p>
          Have questions about our platform? Need help with your implementation? 
          Want to discuss a partnership or enterprise solution? We're here to help 
          you succeed with AI-powered cloud development.
        </p>
        
        <div class="contact-methods">
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-email
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Email Us</h3>
              <p>hello@cloudlesswizard.com</p>
              <span class="response-time">We'll respond within 24 hours</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-chat
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Live Chat</h3>
              <p>Available during business hours</p>
              <span class="response-time">Instant response</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-phone
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Call Us</h3>
              <p>+1 (555) 123-4567</p>
              <span class="response-time">Mon-Fri, 9AM-6PM EST</span>
            </div>
          </div>
          
          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-map-marker
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Visit Us</h3>
              <p>123 Innovation Drive<br>San Francisco, CA 94105</p>
              <span class="response-time">By appointment only</span>
            </div>
          </div>

          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-calendar
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Schedule a Demo</h3>
              <p>Book a personalized demo</p>
              <span class="response-time">30-60 minute sessions</span>
            </div>
          </div>

          <div class="contact-method">
            <div class="method-icon">
              <v-icon size="32" color="primary">
                mdi-account-group
              </v-icon>
            </div>
            <div class="method-content">
              <h3>Join Our Community</h3>
              <p>Discord, Slack, and forums</p>
              <span class="response-time">24/7 community support</span>
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
          
          <div class="form-row">
            <v-text-field
              v-model="form.email"
              label="Email Address"
              variant="outlined"
              type="email"
              required
              class="form-field"
            />
            <v-text-field
              v-model="form.phone"
              label="Phone Number (Optional)"
              variant="outlined"
              class="form-field"
            />
          </div>
          
          <div class="form-row">
            <v-text-field
              v-model="form.company"
              label="Company"
              variant="outlined"
              class="form-field"
            />
            <v-text-field
              v-model="form.jobTitle"
              label="Job Title"
              variant="outlined"
              class="form-field"
            />
          </div>
          
          <v-select
            v-model="form.subject"
            :items="subjectOptions"
            label="Subject"
            variant="outlined"
            required
            class="form-field"
          />
          
          <v-select
            v-model="form.priority"
            :items="priorityOptions"
            label="Priority Level"
            variant="outlined"
            class="form-field"
          />
          
          <v-textarea
            v-model="form.message"
            label="Message"
            variant="outlined"
            rows="6"
            required
            class="form-field"
            placeholder="Tell us about your project, questions, or how we can help you..."
          />
          
          <div class="form-options">
            <v-checkbox
              v-model="form.newsletter"
              label="Subscribe to our newsletter for updates and tips"
              color="primary"
              hide-details
            />
            <v-checkbox
              v-model="form.marketing"
              label="Allow us to contact you about product updates and offers"
              color="primary"
              hide-details
            />
          </div>
          
          <div class="form-actions">
            <v-btn 
              color="primary" 
              size="large" 
              class="submit-btn"
              :loading="isSubmitting"
              @click="submitForm"
            >
              <v-icon left>
                mdi-send
              </v-icon>
              Send Message
            </v-btn>
            <v-btn 
              variant="outlined" 
              size="large" 
              class="reset-btn"
              @click="resetForm"
            >
              Reset Form
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <div class="support-section">
      <h2>Support & Resources</h2>
      <div class="support-grid">
        <div class="support-card">
          <div class="support-icon">
            <v-icon size="32" color="primary">
              mdi-book-open
            </v-icon>
          </div>
          <h3>Documentation</h3>
          <p>Comprehensive guides, API references, and tutorials to help you get started quickly.</p>
          <v-btn color="primary" variant="text" class="support-btn">
            Browse Docs
            <v-icon right>
              mdi-arrow-right
            </v-icon>
          </v-btn>
        </div>
        
        <div class="support-card">
          <div class="support-icon">
            <v-icon size="32" color="primary">
              mdi-video
            </v-icon>
          </div>
          <h3>Video Tutorials</h3>
          <p>Step-by-step video guides covering everything from basic setup to advanced features.</p>
          <v-btn color="primary" variant="text" class="support-btn">
            Watch Videos
            <v-icon right>
              mdi-arrow-right
            </v-icon>
          </v-btn>
        </div>
        
        <div class="support-card">
          <div class="support-icon">
            <v-icon size="32" color="primary">
              mdi-forum
            </v-icon>
          </div>
          <h3>Community Forum</h3>
          <p>Connect with other developers, share solutions, and get help from the community.</p>
          <v-btn color="primary" variant="text" class="support-btn">
            Join Forum
            <v-icon right>
              mdi-arrow-right
            </v-icon>
          </v-btn>
        </div>
        
        <div class="support-card">
          <div class="support-icon">
            <v-icon size="32" color="primary">
              mdi-github
            </v-icon>
          </div>
          <h3>GitHub</h3>
          <p>Open source examples, SDKs, and contribute to our projects on GitHub.</p>
          <v-btn color="primary" variant="text" class="support-btn">
            Visit GitHub
            <v-icon right>
              mdi-arrow-right
            </v-icon>
          </v-btn>
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
            bot, model, or pipeline with interactive tutorials and templates.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>What kind of support do you offer?</h3>
          <p>
            We offer comprehensive support including detailed documentation, video tutorials, 
            live chat during business hours, email support with 24-hour response time, and 
            phone support for enterprise customers. Our team is here to help you succeed.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>Can I integrate with my existing systems?</h3>
          <p>
            Absolutely! Cloudless Wizard is designed to integrate seamlessly with your 
            existing infrastructure. We support all major cloud providers (AWS, GCP, Azure), 
            popular databases, and offer extensive API documentation for custom integrations.
          </p>
        </div>
        
        <div class="faq-item">
          <h3>What are your pricing plans?</h3>
          <p>
            We offer flexible pricing plans starting with a free tier for individual 
            developers. Our paid plans scale with your needs and include enterprise 
            features for larger organizations. Contact us for custom enterprise pricing.
          </p>
        </div>

        <div class="faq-item">
          <h3>Do you offer training and onboarding?</h3>
          <p>
            Yes! We provide comprehensive training programs including live workshops, 
            custom onboarding sessions for enterprise customers, and ongoing support 
            to ensure your team gets the most out of our platform.
          </p>
        </div>

        <div class="faq-item">
          <h3>What security measures do you have in place?</h3>
          <p>
            We take security seriously with SOC 2 compliance, end-to-end encryption, 
            regular security audits, and enterprise-grade security features. Your data 
            and applications are protected with industry-leading security practices.
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
            designed for collaboration and innovation. We welcome visitors by appointment 
            and host regular community events and workshops.
          </p>
          <div class="office-details">
            <div class="detail">
              <v-icon size="20" color="primary">
                mdi-map-marker
              </v-icon>
              <span>123 Innovation Drive, San Francisco, CA 94105</span>
            </div>
            <div class="detail">
              <v-icon size="20" color="primary">
                mdi-clock
              </v-icon>
              <span>Monday - Friday, 9:00 AM - 6:00 PM PST</span>
            </div>
            <div class="detail">
              <v-icon size="20" color="primary">
                mdi-phone
              </v-icon>
              <span>+1 (555) 123-4567</span>
            </div>
            <div class="detail">
              <v-icon size="20" color="primary">
                mdi-email
              </v-icon>
              <span>hello@cloudlesswizard.com</span>
            </div>
          </div>
          <div class="office-actions">
            <v-btn color="primary" variant="outlined" class="office-btn">
              <v-icon left>
                mdi-calendar
              </v-icon>
              Schedule a Visit
            </v-btn>
            <v-btn variant="outlined" class="office-btn">
              <v-icon left>
                mdi-map
              </v-icon>
              Get Directions
            </v-btn>
          </div>
        </div>
        <div class="office-map">
          <div class="map-placeholder">
            <v-icon size="64" color="primary">
              mdi-map
            </v-icon>
            <p>Interactive Map</p>
            <p class="map-note">
              Click to view in Google Maps
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="social-section">
      <h2>Connect With Us</h2>
      <p>Follow us on social media for the latest updates, tips, and community highlights.</p>
      <div class="social-links">
        <v-btn color="primary" variant="outlined" class="social-btn">
          <v-icon left>
            mdi-twitter
          </v-icon>
          Twitter
        </v-btn>
        <v-btn color="primary" variant="outlined" class="social-btn">
          <v-icon left>
            mdi-linkedin
          </v-icon>
          LinkedIn
        </v-btn>
        <v-btn color="primary" variant="outlined" class="social-btn">
          <v-icon left>
            mdi-github
          </v-icon>
          GitHub
        </v-btn>
        <v-btn color="primary" variant="outlined" class="social-btn">
          <v-icon left>
            mdi-youtube
          </v-icon>
          YouTube
        </v-btn>
        <v-btn color="primary" variant="outlined" class="social-btn">
          <v-icon left>
            mdi-discord
          </v-icon>
          Discord
        </v-btn>
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
  phone: '',
  company: '',
  jobTitle: '',
  subject: '',
  priority: 'Medium',
  message: '',
  newsletter: false,
  marketing: false
})

const subjectOptions = [
  'General Inquiry',
  'Technical Support',
  'Sales Question',
  'Partnership',
  'Feature Request',
  'Bug Report',
  'Enterprise Inquiry',
  'Training Request',
  'Other'
]

const priorityOptions = [
  'Low',
  'Medium',
  'High',
  'Urgent'
]

const submitForm = async () => {
  isSubmitting.value = true
  
  // Simulate form submission
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Reset form
  resetForm()
  
  isSubmitting.value = false
  
  // Show success message (you can implement a toast notification here)
  alert('Thank you for your message! We\'ll get back to you soon.')
}

const resetForm = () => {
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    subject: '',
    priority: 'Medium',
    message: '',
    newsletter: false,
    marketing: false
  }
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
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

.contact-info-section,
.contact-form-section,
.support-section,
.faq-section,
.office-section,
.social-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.contact-info-section h2,
.contact-form-section h2,
.support-section h2,
.faq-section h2,
.office-section h2,
.social-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.contact-info-section p,
.social-section p {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.7);
  margin: 0;
}

.contact-methods {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
}

.contact-method {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.contact-method:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.method-icon {
  flex-shrink: 0;
}

.method-content h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.method-content p {
  color: rgba(0, 0, 0, 0.8);
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.response-time {
  color: rgba(0, 0, 0, 0.5);
  font-size: 0.9rem;
}

.contact-form {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-field {
  margin-bottom: 1.5rem;
}

.form-options {
  margin-bottom: 2rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.submit-btn,
.reset-btn {
  min-width: 160px;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.support-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.support-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.support-icon {
  margin-bottom: 1rem;
}

.support-card h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.support-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.support-btn {
  font-weight: 500;
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

.office-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 2.5rem;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
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
  margin-bottom: 2rem;
}

.detail {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: rgba(0, 0, 0, 0.7);
}

.office-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.office-btn {
  min-width: 140px;
}

.office-map {
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-placeholder {
  background: rgba(102, 126, 234, 0.1);
  border: 2px dashed rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  color: rgba(0, 0, 0, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
}

.map-placeholder:hover {
  background: rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.5);
}

.map-placeholder p {
  margin: 0.5rem 0;
}

.map-note {
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.5);
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.social-btn {
  min-width: 120px;
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
    gap: 3rem;
  }
  
  .contact-methods {
    grid-template-columns: 1fr;
  }
  
  .contact-method {
    flex-direction: column;
    text-align: center;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .submit-btn,
  .reset-btn {
    width: 100%;
    max-width: 300px;
  }
  
  .support-grid,
  .faq-grid {
    grid-template-columns: 1fr;
  }
  
  .office-card {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .office-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .office-btn {
    width: 100%;
    max-width: 300px;
  }
  
  .social-links {
    flex-direction: column;
    align-items: center;
  }
  
  .social-btn {
    width: 100%;
    max-width: 300px;
  }
}
</style> 