<template>
  <div class="support-page">
    <div class="page-header">
      <h1>Support Center</h1>
      <p class="subtitle">
        Get help with Cloudless Wizard and find answers to your questions
      </p>
    </div>

    <div class="content-container">
      <div class="support-content">
        <div class="help-section">
          <h2>How can we help you?</h2>
          <div class="search-box">
            <v-text-field
              v-model="searchQuery"
              placeholder="Search for help articles, tutorials, or contact support..."
              variant="outlined"
              prepend-inner-icon="mdi-magnify"
              class="search-input"
            />
          </div>
        </div>

        <div class="quick-help-section">
          <h2>Quick Help</h2>
          <div class="help-grid">
            <div class="help-card">
              <div class="help-icon">
                <v-icon size="48" color="primary">
                  mdi-book-open-variant
                </v-icon>
              </div>
              <h3>Documentation</h3>
              <p>Comprehensive guides and API documentation</p>
              <v-btn color="primary" variant="outlined" class="help-btn">
                Browse Docs
              </v-btn>
            </div>

            <div class="help-card">
              <div class="help-icon">
                <v-icon size="48" color="success">
                  mdi-video
                </v-icon>
              </div>
              <h3>Video Tutorials</h3>
              <p>Step-by-step video guides for common tasks</p>
              <v-btn color="success" variant="outlined" class="help-btn">
                Watch Videos
              </v-btn>
            </div>

            <div class="help-card">
              <div class="help-icon">
                <v-icon size="48" color="warning">
                  mdi-forum
                </v-icon>
              </div>
              <h3>Community Forum</h3>
              <p>Connect with other developers and share solutions</p>
              <v-btn color="warning" variant="outlined" class="help-btn">
                Join Forum
              </v-btn>
            </div>

            <div class="help-card">
              <div class="help-icon">
                <v-icon size="48" color="info">
                  mdi-headset
                </v-icon>
              </div>
              <h3>Live Chat</h3>
              <p>Get instant help from our support team</p>
              <v-btn color="info" variant="outlined" class="help-btn">
                Start Chat
              </v-btn>
            </div>
          </div>
        </div>

        <div class="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div class="faq-grid">
            <div v-for="faq in faqs" :key="faq.id" class="faq-item">
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

        <div class="contact-section">
          <h2>Still need help?</h2>
          <div class="contact-grid">
            <div class="contact-card">
              <div class="contact-icon">
                <v-icon size="48" color="primary">
                  mdi-email
                </v-icon>
              </div>
              <h3>Email Support</h3>
              <p>Send us a detailed message and we'll get back to you within 24 hours</p>
              <v-btn color="primary" variant="elevated" class="contact-btn">
                Send Email
              </v-btn>
            </div>

            <div class="contact-card">
              <div class="contact-icon">
                <v-icon size="48" color="success">
                  mdi-phone
                </v-icon>
              </div>
              <h3>Phone Support</h3>
              <p>Call us during business hours for immediate assistance</p>
              <v-btn color="success" variant="elevated" class="contact-btn">
                Call Now
              </v-btn>
            </div>

            <div class="contact-card">
              <div class="contact-icon">
                <v-icon size="48" color="warning">
                  mdi-calendar
                </v-icon>
              </div>
              <h3>Schedule a Call</h3>
              <p>Book a 30-minute consultation with our technical team</p>
              <v-btn color="warning" variant="elevated" class="contact-btn">
                Book Call
              </v-btn>
            </div>
          </div>
        </div>

        <div class="status-section">
          <h2>System Status</h2>
          <div class="status-grid">
            <div class="status-card">
              <div class="status-header">
                <h3>Platform Status</h3>
                <v-chip color="success" size="small">
                  All Systems Operational
                </v-chip>
              </div>
              <p>All services are running normally</p>
              <div class="status-details">
                <div class="status-item">
                  <span>API Services</span>
                  <v-icon color="success" size="16">
                    mdi-check-circle
                  </v-icon>
                </div>
                <div class="status-item">
                  <span>Model Training</span>
                  <v-icon color="success" size="16">
                    mdi-check-circle
                  </v-icon>
                </div>
                <div class="status-item">
                  <span>Deployment</span>
                  <v-icon color="success" size="16">
                    mdi-check-circle
                  </v-icon>
                </div>
              </div>
            </div>

            <div class="status-card">
              <div class="status-header">
                <h3>Recent Updates</h3>
                <v-chip color="info" size="small">
                  Latest
                </v-chip>
              </div>
              <div class="updates-list">
                <div class="update-item">
                  <div class="update-time">
                    2 hours ago
                  </div>
                  <div class="update-text">
                    Enhanced pipeline builder released
                  </div>
                </div>
                <div class="update-item">
                  <div class="update-time">
                    1 day ago
                  </div>
                  <div class="update-text">
                    Performance improvements deployed
                  </div>
                </div>
                <div class="update-item">
                  <div class="update-time">
                    3 days ago
                  </div>
                  <div class="update-text">
                    New AI models available
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const searchQuery = ref('')

const faqs = ref([
  {
    id: 1,
    question: 'How do I get started with Cloudless Wizard?',
    answer: 'Getting started is easy! Simply sign up for an account, choose a plan that fits your needs, and follow our quick setup guide. You can start building AI models and deploying applications within minutes.'
  },
  {
    id: 2,
    question: 'What programming languages are supported?',
    answer: 'Cloudless Wizard supports multiple programming languages including Python, JavaScript, TypeScript, and more. Our platform is designed to be language-agnostic, allowing you to work with your preferred technology stack.'
  },
  {
    id: 3,
    question: 'How much does Cloudless Wizard cost?',
    answer: 'We offer flexible pricing plans starting from $29/month for individual developers. Enterprise plans are available for larger teams and organizations. All plans include access to our core features and support.'
  },
  {
    id: 4,
    question: 'Can I deploy my own models?',
    answer: 'Yes! You can deploy custom models trained on your own data. Our platform supports various model formats and provides tools for model optimization and deployment to production environments.'
  },
  {
    id: 5,
    question: 'Is my data secure?',
    answer: 'Security is our top priority. We use industry-standard encryption, secure data centers, and follow best practices for data protection. Your data is never shared with third parties without your explicit consent.'
  },
  {
    id: 6,
    question: 'What kind of support do you offer?',
    answer: 'We provide comprehensive support including documentation, video tutorials, community forums, email support, and phone support for enterprise customers. Our team is available to help you succeed.'
  },
  {
    id: 7,
    question: 'Can I integrate with existing systems?',
    answer: 'Absolutely! Cloudless Wizard provides APIs and SDKs for easy integration with your existing systems and workflows. We support popular frameworks and cloud platforms.'
  },
  {
    id: 8,
    question: 'How do I scale my applications?',
    answer: 'Our platform automatically handles scaling based on your application needs. You can configure auto-scaling policies and monitor performance through our dashboard.'
  }
])
</script>

<style scoped>
.support-page {
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

.support-content {
  max-width: 1000px;
  margin: 0 auto;
}

.help-section {
  margin-bottom: 4rem;
}

.help-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.search-box {
  max-width: 600px;
  margin: 0 auto;
}

.search-input {
  font-size: 1.1rem;
}

.quick-help-section {
  margin-bottom: 4rem;
}

.quick-help-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.help-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.help-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.help-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.help-icon {
  margin-bottom: 1rem;
}

.help-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.help-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.help-btn {
  width: 100%;
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
  gap: 1rem;
}

.faq-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

.contact-section {
  margin-bottom: 4rem;
}

.contact-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.contact-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.contact-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.contact-icon {
  margin-bottom: 1rem;
}

.contact-card h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.contact-card p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.contact-btn {
  width: 100%;
}

.status-section {
  margin-bottom: 2rem;
}

.status-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
  text-align: center;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.status-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(102, 126, 234, 0.1);
  border-radius: 16px;
  padding: 2rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-header h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
}

.status-card p {
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 1.5rem;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.status-item:last-child {
  border-bottom: none;
}

.status-item span {
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
}

.updates-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.update-item {
  padding: 1rem;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
  border-left: 3px solid #667eea;
}

.update-time {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.25rem;
}

.update-text {
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .support-page {
    padding: 1rem;
  }
  
  .content-container {
    padding: 2rem;
  }
  
  .help-grid {
    grid-template-columns: 1fr;
  }
  
  .contact-grid {
    grid-template-columns: 1fr;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 