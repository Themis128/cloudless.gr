<template>
  <div>
    <v-container class="faq-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Find answers to common questions about Cloudless Wizard
          </p>
        </v-col>
      </v-row>

      <!-- Search Section -->
      <v-row justify="center" class="mb-8">
        <v-col cols="12" md="6" lg="4">
          <v-text-field
            v-model="searchQuery"
            placeholder="Search FAQs..."
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            clearable
            hide-details
            @update:model-value="filterQuestions"
            :ripple="false"
          />
        </v-col>
      </v-row>

      <!-- FAQ Categories -->
      <v-row v-if="filteredQuestions.length > 0">
        <v-col
          v-for="category in uniqueCategories"
          :key="category"
          cols="12"
          class="mb-8"
        >
          <v-card class="category-card" elevation="4">
            <v-card-title class="text-h4 mb-6">
              {{ category }}
            </v-card-title>

            <v-card-text class="pa-0">
              <v-expansion-panels variant="accordion">
                <v-expansion-panel
                  v-for="question in getQuestionsByCategory(category)"
                  :key="question.id"
                  class="faq-panel"
                >
                  <v-expansion-panel-title class="text-h6 font-weight-medium">
                    {{ question.question }}
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <div class="faq-answer" v-html="question.answer"></div>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- No Results -->
      <v-row v-else-if="searchQuery" justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <v-card class="no-results-card" elevation="4">
            <v-card-text class="pa-8">
              <v-icon size="64" color="grey" class="mb-4">
                mdi-magnify-close
              </v-icon>
              <h3 class="text-h5 font-weight-bold mb-4">No FAQs Found</h3>
              <p class="text-body-1 text-medium-emphasis mb-6">
                No FAQs found matching "{{ searchQuery }}"
              </p>
              <v-btn
                color="primary"
                variant="outlined"
                @click="resetSearch"
                :ripple="false"
              >
                <v-icon start>mdi-refresh</v-icon>
                Reset Search
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Contact Support Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6">
          <v-card class="contact-support-card" elevation="8" color="primary">
            <v-card-text class="pa-8 text-center">
              <v-icon size="64" color="white" class="mb-4">
                mdi-headset
              </v-icon>
              <h2 class="text-h4 font-weight-bold mb-4 text-white">
                Still have questions?
              </h2>
              <p class="text-h6 text-white mb-6">
                Can't find what you're looking for? Our support team is here to
                help.
              </p>
              <div class="d-flex flex-wrap justify-center">
                <v-btn
                  color="white"
                  variant="outlined"
                  size="large"
                  class="mr-4"
                  to="/contact"
                  :ripple="false"
                >
                  <v-icon start>mdi-email</v-icon>
                  Contact Support
                </v-btn>
                <v-btn color="white" size="large" to="/support" :ripple="false">
                  <v-icon start>mdi-help-circle</v-icon>
                  Support Center
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { useNotificationsStore } from '@/stores/useNotificationsStore'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

// Types
interface FAQ {
  id: number
  question: string
  answer: string
  category: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Reactive state
const searchQuery = ref('')
const filteredQuestions = ref<FAQ[]>([])

// FAQ data
const faqs: FAQ[] = [
  {
    id: 1,
    question: 'What services does Cloudless Wizard provide?',
    answer:
      'Cloudless Wizard offers a comprehensive suite of AI and machine learning services. Our expertise includes custom AI model development, data pipeline creation, bot building, cloud deployments, and performance optimization for AI applications.',
    category: 'Services',
  },
  {
    id: 2,
    question: 'How do I request a quote for my project?',
    answer:
      "You can request a quote by visiting our <a href='/contact' class='text-primary'>Contact page</a> and filling out the form with details about your project requirements. Our team will review your request and get back to you within 1-2 business days with a customized quote.",
    category: 'Business',
  },
  {
    id: 3,
    question: 'Do you provide support after project completion?',
    answer:
      'Yes, we offer ongoing support and maintenance packages for all completed projects. Our support packages include regular updates, security patches, performance monitoring, and technical assistance. You can choose a support plan that best fits your needs during the project discussion phase.',
    category: 'Services',
  },
  {
    id: 4,
    question: 'What AI technologies do you specialize in?',
    answer:
      "We specialize in modern AI technologies including machine learning, deep learning, natural language processing, computer vision, and large language models. We're also experts in cloud platforms like AWS, Google Cloud, and Azure, as well as containerization with Docker and Kubernetes for AI deployments.",
    category: 'Technical',
  },
  {
    id: 5,
    question: 'How long does a typical project take?',
    answer:
      'Project timelines vary depending on complexity and scope. Simple AI integrations can take 2-4 weeks, while complex custom AI solutions may take 3-6 months. We provide detailed timelines during the planning phase and keep you updated throughout the development process.',
    category: 'Business',
  },
  {
    id: 6,
    question: 'Do you work with startups and small businesses?',
    answer:
      'Absolutely! We work with businesses of all sizes, from startups to enterprise companies. We offer flexible pricing models and can scale our services to meet your specific needs and budget constraints.',
    category: 'Business',
  },
  {
    id: 7,
    question: 'What is your pricing model?',
    answer:
      'We offer flexible pricing including project-based pricing, subscription plans, and custom enterprise solutions. Pricing depends on project scope, complexity, and ongoing support requirements. Contact us for a personalized quote.',
    category: 'Business',
  },
  {
    id: 8,
    question: 'Do you provide training and documentation?',
    answer:
      'Yes, we provide comprehensive training, documentation, and ongoing support to ensure your team can effectively use our AI solutions. This includes user guides, API documentation, and hands-on training sessions.',
    category: 'Services',
  },
  {
    id: 9,
    question: 'How do you ensure data security and privacy?',
    answer:
      'We implement enterprise-grade security measures including encryption at rest and in transit, secure API endpoints, and compliance with data protection regulations. We can also work with your existing security infrastructure and policies.',
    category: 'Security',
  },
  {
    id: 10,
    question: 'Can you integrate with our existing systems?',
    answer:
      'Yes, we specialize in integrating AI solutions with existing systems and workflows. We work with various APIs, databases, and third-party services to ensure seamless integration with your current infrastructure.',
    category: 'Technical',
  },
  {
    id: 11,
    question: 'What kind of AI models can you develop?',
    answer:
      'We develop a wide range of AI models including natural language processing models, computer vision models, recommendation systems, predictive analytics models, and custom neural networks tailored to your specific use case.',
    category: 'Technical',
  },
  {
    id: 12,
    question: 'Do you offer maintenance and updates?',
    answer:
      'Yes, we offer comprehensive maintenance packages that include regular updates, model retraining, performance monitoring, and technical support. We can also provide ongoing development and feature enhancements.',
    category: 'Services',
  },
]

// Computed properties
const uniqueCategories = computed(() => {
  const categories = [...new Set(filteredQuestions.value.map(q => q.category))]
  return categories.sort()
})

// Methods
const filterQuestions = () => {
  if (!searchQuery.value.trim()) {
    filteredQuestions.value = faqs
    return
  }

  const query = searchQuery.value.toLowerCase()
  filteredQuestions.value = faqs.filter(
    faq =>
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      faq.category.toLowerCase().includes(query)
  )
}

const getQuestionsByCategory = (category: string) => {
  return filteredQuestions.value.filter(q => q.category === category)
}

const resetSearch = () => {
  searchQuery.value = ''
  filteredQuestions.value = faqs
  notificationsStore.info('Search Reset', 'FAQ search has been reset')
}

// Initialize
filteredQuestions.value = faqs

// Meta
definePageMeta({
  title: 'Frequently Asked Questions - Cloudless Wizard',
  description:
    "Find answers to common questions about Cloudless Wizard's AI development services, pricing, and support options.",
  layout: 'default',
})
</script>

<style scoped>
.faq-page {
  max-width: 1200px;
  margin: 0 auto;
}

.category-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.faq-panel {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.faq-panel:last-child {
  border-bottom: none;
}

.faq-answer {
  line-height: 1.6;
  color: var(--v-theme-on-surface-variant);
}

.faq-answer :deep(a) {
  color: var(--v-theme-primary);
  text-decoration: none;
  font-weight: 500;
}

.faq-answer :deep(a:hover) {
  text-decoration: underline;
}

.no-results-card {
  border-radius: 16px;
}

.contact-support-card {
  background: linear-gradient(
    135deg,
    var(--v-theme-primary) 0%,
    var(--v-theme-secondary) 100%
  );
  border-radius: 16px;
}

/* Responsive improvements */
@media (max-width: 600px) {
  .faq-page {
    padding: 0 16px;
  }
}

/* Accessibility improvements */
:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

/* Smooth transitions */
.v-card {
  transition: all 0.3s ease-in-out;
}

.v-expansion-panel {
  transition: all 0.3s ease-in-out;
}
</style>
