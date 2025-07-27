<template>
  <div>
    <v-container class="pricing-page">
      <!-- Hero Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4">Pricing Plans</h1>
          <p class="text-h6 text-medium-emphasis">
            Choose the perfect plan for your needs
          </p>
        </v-col>
      </v-row>

      <!-- Billing Toggle -->
      <v-row justify="center" class="mb-8">
        <v-col cols="12" sm="6" md="4" class="text-center">
          <v-card class="billing-toggle-card" elevation="2">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-center">
                <span class="text-body-1 font-weight-medium mr-4">Billing</span>
                <v-switch
                  v-model="isAnnual"
                  :label="isAnnual ? 'Annual (Save 20%)' : 'Monthly'"
                  color="primary"
                  hide-details
                  :ripple="false"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Pricing Plans -->
      <v-row class="mb-12">
        <v-col v-for="plan in plans" :key="plan.id" cols="12" md="6" lg="4">
          <PricingCard
            :plan="plan"
            :is-annual="isAnnual"
            @select="handlePlanSelect(plan)"
          />
        </v-col>
      </v-row>

      <!-- Enterprise Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <v-card class="enterprise-card" elevation="8" color="primary">
            <v-card-text class="pa-8">
              <v-row align="center">
                <v-col cols="12" lg="8">
                  <h2 class="text-h3 font-weight-bold mb-4 text-white">
                    Enterprise
                  </h2>
                  <p class="text-h6 text-white mb-6">
                    Need a custom solution? Our enterprise plan includes
                    dedicated support, custom integrations, and unlimited
                    resources for large organizations.
                  </p>
                  <div class="d-flex flex-wrap">
                    <v-btn
                      color="white"
                      variant="outlined"
                      size="large"
                      class="mr-4"
                      to="/contact"
                      :ripple="false"
                    >
                      <v-icon start>mdi-phone</v-icon>
                      Contact Sales
                    </v-btn>
                    <v-btn
                      color="white"
                      size="large"
                      to="/enterprise"
                      :ripple="false"
                    >
                      <v-icon start>mdi-information</v-icon>
                      Learn More
                    </v-btn>
                  </div>
                </v-col>
                <v-col cols="12" lg="4" class="text-center">
                  <v-icon size="120" color="white" class="mb-4">
                    mdi-office-building
                  </v-icon>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- FAQ Section -->
      <v-row class="mb-12">
        <v-col cols="12">
          <div class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p class="text-h6 text-medium-emphasis">
              Everything you need to know about our pricing
            </p>
          </div>

          <v-row>
            <v-col v-for="faq in faqs" :key="faq.id" cols="12" md="6">
              <FAQCard :faq="faq" />
            </v-col>
          </v-row>
        </v-col>
      </v-row>

      <!-- CTA Section -->
      <v-row justify="center" class="mb-12">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <v-card class="cta-card" elevation="8">
            <v-card-text class="pa-8">
              <h2 class="text-h3 font-weight-bold mb-4">
                Ready to Get Started?
              </h2>
              <p class="text-h6 text-medium-emphasis mb-6">
                Join thousands of developers building the future with Cloudless
              </p>
              <div class="d-flex flex-wrap justify-center">
                <v-btn
                  color="primary"
                  variant="outlined"
                  size="large"
                  class="mr-4"
                  to="/register"
                  :ripple="false"
                >
                  <v-icon start>mdi-account-plus</v-icon>
                  Start Free Trial
                </v-btn>
                <v-btn
                  color="primary"
                  size="large"
                  to="/contact"
                  :ripple="false"
                >
                  <v-icon start>mdi-email</v-icon>
                  Contact Us
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// Types
interface Plan {
  id: string
  name: string
  description: string
  monthlyPrice: number
  annualPrice: number
  features: string[]
  limits: {
    apiRequests: string
    bots: number
    models: number
    pipelines: number
    teamMembers: number
  }
  popular: boolean
  buttonText: string
}

interface FAQ {
  id: string
  question: string
  answer: string
}

// Composables
const router = useRouter()
const notificationsStore = useNotificationsStore()

// Reactive state
const isAnnual = ref(false)

// Data
const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals and small projects',
    monthlyPrice: 29,
    annualPrice: 290,
    features: [
      'Up to 5 AI models',
      'Basic analytics',
      'Email support',
      'API access',
      'Community forum',
    ],
    limits: {
      apiRequests: '10K',
      bots: 3,
      models: 5,
      pipelines: 2,
      teamMembers: 1,
    },
    popular: false,
    buttonText: 'Start Free Trial',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing teams and businesses',
    monthlyPrice: 99,
    annualPrice: 990,
    features: [
      'Up to 25 AI models',
      'Advanced analytics',
      'Priority support',
      'Custom integrations',
      'Team collaboration',
      'Advanced security',
    ],
    limits: {
      apiRequests: '100K',
      bots: 15,
      models: 25,
      pipelines: 10,
      teamMembers: 10,
    },
    popular: true,
    buttonText: 'Start Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    monthlyPrice: 299,
    annualPrice: 2990,
    features: [
      'Unlimited AI models',
      'Enterprise analytics',
      '24/7 phone support',
      'Custom development',
      'Advanced security',
      'SLA guarantee',
      'Dedicated account manager',
    ],
    limits: {
      apiRequests: 'Unlimited',
      bots: 100,
      models: 100,
      pipelines: 50,
      teamMembers: 50,
    },
    popular: false,
    buttonText: 'Contact Sales',
  },
]

const faqs: FAQ[] = [
  {
    id: 'billing',
    question: 'Can I change my plan at any time?',
    answer:
      'Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated and reflected in your next billing cycle.',
  },
  {
    id: 'trial',
    question: 'Is there a free trial?',
    answer:
      'Yes, all plans come with a 14-day free trial. No credit card required to start your trial.',
  },
  {
    id: 'refund',
    question: 'What is your refund policy?',
    answer:
      "We offer a 30-day money-back guarantee. If you're not satisfied, contact our support team for a full refund.",
  },
  {
    id: 'support',
    question: 'What kind of support do you provide?',
    answer:
      'Starter plans include email support, Professional plans include priority support, and Enterprise plans include 24/7 phone support.',
  },
  {
    id: 'security',
    question: 'How secure is my data?',
    answer:
      'We use enterprise-grade security with encryption at rest and in transit, SOC 2 compliance, and regular security audits.',
  },
  {
    id: 'custom',
    question: 'Do you offer custom plans?',
    answer:
      'Yes, we offer custom enterprise plans for organizations with specific requirements. Contact our sales team for details.',
  },
]

// Methods
const handlePlanSelect = async (plan: Plan) => {
  try {
    if (plan.id === 'enterprise') {
      await router.push('/contact')
      notificationsStore.info(
        'Enterprise',
        'Redirecting to contact page for enterprise inquiries'
      )
    } else {
      await router.push('/register')
      notificationsStore.success(
        'Plan Selected',
        `Starting free trial for ${plan.name} plan`
      )
    }
  } catch (error) {
    notificationsStore.error('Error', 'Failed to navigate to selected plan')
  }
}

// Meta
definePageMeta({
  title: 'Pricing Plans - Cloudless Wizard',
  description:
    'Choose the perfect pricing plan for your AI development needs. Start with our free trial and scale as you grow.',
  layout: 'default',
})
</script>

<style scoped>
.pricing-page {
  max-width: 1200px;
  margin: 0 auto;
}

.billing-toggle-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.billing-toggle-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.enterprise-card {
  background: linear-gradient(
    135deg,
    var(--v-theme-primary) 0%,
    var(--v-theme-secondary) 100%
  );
  border-radius: 16px;
}

.cta-card {
  border-radius: 16px;
  transition: all 0.3s ease-in-out;
}

.cta-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* Responsive improvements */
@media (max-width: 600px) {
  .pricing-page {
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
</style>
