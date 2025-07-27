<template>
  <v-container class="support-page">
    <div class="text-center mb-8">
      <h1 class="text-h2 font-weight-bold mb-4">Support Center</h1>
      <p class="text-body-1 text-medium-emphasis">
        Get help with Cloudless Wizard and find answers to your questions
      </p>
    </div>

    <v-row>
      <v-col cols="12">
        <div class="text-center mb-8">
          <h2 class="text-h4 mb-6">How can we help you?</h2>
          <v-text-field
            v-model="searchQuery"
            placeholder="Search for help articles, tutorials, or contact support..."
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            class="max-width-md mx-auto"
            style="max-width: 600px"
          />
        </div>

        <div class="mb-8">
          <h2 class="text-h4 text-center mb-6">Quick Help</h2>
          <v-row>
            <v-col cols="12" md="6" lg="3">
              <v-card class="help-card text-center pa-6" hover>
                <v-icon size="48" color="primary" class="mb-4">
                  mdi-book-open-variant
                </v-icon>
                <h3 class="text-h6 mb-2">Documentation</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Comprehensive guides and API documentation
                </p>
                <v-btn color="primary" variant="outlined" block>
                  Browse Docs
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="6" lg="3">
              <v-card class="help-card text-center pa-6" hover>
                <v-icon size="48" color="success" class="mb-4">
                  mdi-video
                </v-icon>
                <h3 class="text-h6 mb-2">Video Tutorials</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Step-by-step video guides for common tasks
                </p>
                <v-btn color="success" variant="outlined" block>
                  Watch Videos
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="6" lg="3">
              <v-card class="help-card text-center pa-6" hover>
                <v-icon size="48" color="warning" class="mb-4">
                  mdi-forum
                </v-icon>
                <h3 class="text-h6 mb-2">Community Forum</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Connect with other developers and share solutions
                </p>
                <v-btn color="warning" variant="outlined" block>
                  Join Forum
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="6" lg="3">
              <v-card class="help-card text-center pa-6" hover>
                <v-icon size="48" color="info" class="mb-4">
                  mdi-headset
                </v-icon>
                <h3 class="text-h6 mb-2">Live Chat</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Get instant help from our support team
                </p>
                <v-btn color="info" variant="outlined" block>
                  Start Chat
                </v-btn>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <div class="mb-8">
          <h2 class="text-h4 text-center mb-6">Frequently Asked Questions</h2>
          <v-row>
            <v-col cols="12" lg="8" class="mx-auto">
              <v-expansion-panels>
                <v-expansion-panel v-for="faq in faqs" :key="faq.id">
                  <v-expansion-panel-title>
                    {{ faq.question }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <p class="text-body-1">{{ faq.answer }}</p>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-col>
          </v-row>
        </div>

        <div class="mb-8">
          <h2 class="text-h4 text-center mb-6">Contact Support</h2>
          <v-row>
            <v-col cols="12" md="4">
              <v-card class="text-center pa-6" hover>
                <v-icon size="48" color="primary" class="mb-4">
                  mdi-email
                </v-icon>
                <h3 class="text-h6 mb-2">Email Support</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Send us an email and we'll get back to you within 24 hours
                </p>
                <v-btn color="primary" variant="outlined" block>
                  Send Email
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="4">
              <v-card class="text-center pa-6" hover>
                <v-icon size="48" color="success" class="mb-4">
                  mdi-phone
                </v-icon>
                <h3 class="text-h6 mb-2">Phone Support</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Call us during business hours for immediate assistance
                </p>
                <v-btn color="success" variant="outlined" block>
                  Call Now
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="4">
              <v-card class="text-center pa-6" hover>
                <v-icon size="48" color="info" class="mb-4">
                  mdi-ticket
                </v-icon>
                <h3 class="text-h6 mb-2">Support Ticket</h3>
                <p class="text-body-2 text-medium-emphasis mb-4">
                  Create a support ticket for complex technical issues
                </p>
                <v-btn color="info" variant="outlined" block>
                  Create Ticket
                </v-btn>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <div class="mb-8">
          <h2 class="text-h4 text-center mb-6">System Status</h2>
          <v-row>
            <v-col cols="12" md="3">
              <v-card class="text-center pa-4">
                <v-icon size="32" color="success" class="mb-2">
                  mdi-check-circle
                </v-icon>
                <div class="text-h5 font-weight-bold text-success">
                  Operational
                </div>
                <div class="text-body-2 text-medium-emphasis">API Services</div>
              </v-card>
            </v-col>

            <v-col cols="12" md="3">
              <v-card class="text-center pa-4">
                <v-icon size="32" color="success" class="mb-2">
                  mdi-check-circle
                </v-icon>
                <div class="text-h5 font-weight-bold text-success">
                  Operational
                </div>
                <div class="text-body-2 text-medium-emphasis">Bot Services</div>
              </v-card>
            </v-col>

            <v-col cols="12" md="3">
              <v-card class="text-center pa-4">
                <v-icon size="32" color="warning" class="mb-2">
                  mdi-alert
                </v-icon>
                <div class="text-h5 font-weight-bold text-warning">
                  Degraded
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Model Training
                </div>
              </v-card>
            </v-col>

            <v-col cols="12" md="3">
              <v-card class="text-center pa-4">
                <v-icon size="32" color="success" class="mb-2">
                  mdi-check-circle
                </v-icon>
                <div class="text-h5 font-weight-bold text-success">
                  Operational
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Pipeline Services
                </div>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')

const faqs = ref([
  {
    id: 1,
    question: 'How do I get started with Cloudless Wizard?',
    answer:
      'Getting started is easy! Simply sign up for an account, choose a plan that fits your needs, and follow our quick setup guide. You can start building AI models and deploying applications within minutes.',
  },
  {
    id: 2,
    question: 'What programming languages are supported?',
    answer:
      'Cloudless Wizard supports multiple programming languages including Python, JavaScript, TypeScript, and more. Our platform is designed to be language-agnostic, allowing you to work with your preferred technology stack.',
  },
  {
    id: 3,
    question: 'How much does Cloudless Wizard cost?',
    answer:
      'We offer flexible pricing plans starting from $29/month for individual developers. Enterprise plans are available for larger teams and organizations. All plans include access to our core features and support.',
  },
  {
    id: 4,
    question: 'Can I deploy my own models?',
    answer:
      'Yes! You can deploy custom models trained on your own data. Our platform supports various model formats and provides tools for model optimization and deployment to production environments.',
  },
  {
    id: 5,
    question: 'Is my data secure?',
    answer:
      'Security is our top priority. We use industry-standard encryption, secure data centers, and follow best practices for data protection. Your data is never shared with third parties without your explicit consent.',
  },
  {
    id: 6,
    question: 'What kind of support do you offer?',
    answer:
      'We provide comprehensive support including documentation, video tutorials, community forums, email support, and phone support for enterprise customers. Our team is available to help you succeed.',
  },
  {
    id: 7,
    question: 'Can I integrate with existing systems?',
    answer:
      'Absolutely! Cloudless Wizard provides APIs and SDKs for easy integration with your existing systems and workflows. We support popular frameworks and cloud platforms.',
  },
  {
    id: 8,
    question: 'How do I scale my applications?',
    answer:
      'Our platform automatically handles scaling based on your application needs. You can configure auto-scaling policies and monitor performance through our dashboard.',
  },
])
</script>

<style scoped>
.support-page {
  max-width: 1200px;
  margin: 0 auto;
}

.help-card {
  transition: transform 0.3s ease;
}

.help-card:hover {
  transform: translateY(-2px);
}
</style>
