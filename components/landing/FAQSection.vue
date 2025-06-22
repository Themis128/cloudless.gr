<template>
  <section class="faq-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" class="text-center mb-12">
          <h2 class="text-h3 font-weight-bold mb-4 text-white">
            Frequently Asked Questions
          </h2>
          <p class="text-h6 text-grey-lighten-2">
            Everything you need to know about Cloudless
          </p>
        </v-col>
      </v-row>

      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <v-expansion-panels
            variant="accordion"
            multiple
            class="faq-panels"
          >
            <v-expansion-panel
              v-for="(faq, index) in faqs"
              :key="index"
              class="faq-panel"
            >
              <v-expansion-panel-title class="text-h6 font-weight-medium">
                <template #default="{ expanded }">
                  <div class="d-flex align-center">
                    <v-icon
                      :icon="expanded ? 'mdi-minus' : 'mdi-plus'"
                      class="mr-3 text-primary"
                    />
                    {{ faq.question }}
                  </div>
                </template>
              </v-expansion-panel-title>
              <v-expansion-panel-text class="text-body-1">
                <div class="pa-4">
                  {{ faq.answer }}
                  <div v-if="faq.learnMore" class="mt-3">
                    <v-btn
                      variant="text"
                      color="primary"
                      size="small"
                      :href="faq.learnMore.url"
                      target="_blank"
                      append-icon="mdi-open-in-new"
                    >
                      {{ faq.learnMore.text }}
                    </v-btn>
                  </div>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>

      <!-- Contact support -->
      <v-row justify="center" class="mt-12">
        <v-col cols="12" md="8" class="text-center">
          <v-card
            class="support-card pa-6"
            elevation="8"
            rounded="xl"
          >
            <v-card-text>
              <v-icon
                icon="mdi-help-circle"
                size="64"
                class="mb-4 text-primary"
              />
              <h3 class="text-h5 font-weight-bold mb-4">
                Still have questions?
              </h3>
              <p class="text-body-1 mb-6 text-grey-darken-2">
                Our support team is here to help you get the most out of Cloudless.
              </p>
              <div class="d-flex flex-wrap justify-center gap-3">
                <v-btn
                  color="primary"
                  size="large"
                  prepend-icon="mdi-chat"
                  @click="openChat"
                >
                  Start Live Chat
                </v-btn>
                <v-btn
                  variant="outlined"
                  size="large"
                  prepend-icon="mdi-email"
                  href="mailto:support@cloudless.gr"
                >
                  Email Support
                </v-btn>
                <v-btn
                  variant="outlined"
                  size="large"
                  prepend-icon="mdi-book-open"
                  href="/documentation"
                >
                  Documentation
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script setup lang="ts">
interface FAQ {
  question: string;
  answer: string;
  learnMore?: {
    text: string;
    url: string;
  };
}

const faqs: FAQ[] = [
  {
    question: "What is Cloudless and how does it work?",
    answer: "Cloudless is a no-code platform that allows you to build powerful cloud workflows and analytics pipelines without writing any code. Simply drag and drop components to create complex data processing workflows.",
    learnMore: {
      text: "Learn more about our platform",
      url: "/documentation"
    }
  },
  {
    question: "Do I need technical knowledge to use Cloudless?",
    answer: "No! Cloudless is designed for non-technical users. Our intuitive drag-and-drop interface makes it easy for anyone to build powerful workflows. However, technical users will appreciate the advanced features and customization options available."
  },
  {
    question: "What data sources can I connect to?",
    answer: "Cloudless supports a wide range of data sources including databases (MySQL, PostgreSQL, MongoDB), cloud storage (AWS S3, Google Drive, Dropbox), APIs, spreadsheets, and many more. We're constantly adding new integrations."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We take security seriously with enterprise-grade encryption, SOC 2 compliance, GDPR compliance, and regular security audits. Your data is encrypted in transit and at rest, and we never store your actual data - only metadata about your workflows."
  },
  {
    question: "Can I integrate Cloudless with my existing tools?",
    answer: "Yes! Cloudless offers extensive integration options including REST APIs, webhooks, and pre-built connectors for popular tools like Slack, Zapier, and more. You can also export your workflows and run them anywhere."
  },
  {
    question: "What happens if I hit my plan limits?",
    answer: "We'll notify you as you approach your limits. If you exceed them, your workflows will be temporarily paused until you upgrade your plan or the next billing cycle begins. You can upgrade at any time with immediate effect."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time. You'll continue to have access to paid features until the end of your current billing period. After that, your account will automatically switch to the free plan."
  },
  {
    question: "Do you offer custom enterprise solutions?",
    answer: "Yes! Our Enterprise plan includes custom workflow development, on-premise deployment options, dedicated support, and SLA guarantees. Contact our sales team to discuss your specific requirements.",
    learnMore: {
      text: "Contact Enterprise Sales",
      url: "/contact?type=enterprise"
    }
  },
  {
    question: "What kind of support do you provide?",
    answer: "We offer multiple support channels: community forums for free users, email support for Pro users, and 24/7 phone support for Enterprise customers. We also provide comprehensive documentation and video tutorials."
  },
  {
    question: "Can I migrate from other no-code platforms?",
    answer: "Yes! We provide migration assistance and tools to help you move from other platforms. Our team can help you recreate your existing workflows and optimize them for Cloudless. Contact support for migration assistance."
  }
];

const openChat = () => {
  // In a real application, this would open a chat widget
  console.log('Opening chat...');
  // For now, redirect to contact page
  window.location.href = '/contact';
};
</script>

<style scoped>
.faq-section {
  background: linear-gradient(135deg, rgba(118, 75, 162, 0.1) 0%, rgba(103, 126, 234, 0.1) 100%);
  backdrop-filter: blur(10px);
}

.faq-panels {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  overflow: hidden;
}

.faq-panel {
  background: rgba(255, 255, 255, 0.95) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.faq-panel:hover {
  background: rgba(255, 255, 255, 1) !important;
}

.faq-panel:last-child {
  border-bottom: none;
}

.support-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.support-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
  transition: all 0.3s ease;
}

.gap-3 {
  gap: 12px;
}

@media (max-width: 768px) {
  .d-flex.flex-wrap.justify-center.gap-3 {
    flex-direction: column;
    align-items: center;
  }
  
  .d-flex.flex-wrap.justify-center.gap-3 .v-btn {
    width: 100%;
    max-width: 250px;
  }
}
</style>
