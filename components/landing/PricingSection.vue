<template>
  <section class="pricing-section py-16">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" class="text-center mb-12">
          <h2 class="text-h3 font-weight-bold mb-4 text-white">
            Simple, Transparent Pricing
          </h2>
          <p class="text-h6 text-grey-lighten-2 mb-6">
            Choose the plan that's right for you
          </p>
          
          <!-- Billing toggle -->
          <div class="d-flex align-center justify-center mb-8">
            <span class="text-body-1 text-white mr-4">Monthly</span>
            <v-switch
              v-model="isYearly"
              color="primary"
              hide-details
              inset
            />
            <span class="text-body-1 text-white ml-4">
              Yearly 
              <v-chip size="small" color="success" class="ml-2">Save 20%</v-chip>
            </span>
          </div>
        </v-col>
      </v-row>

      <v-row justify="center">        <v-col
        v-for="plan in plans"
        :key="plan.name"
        cols="12"
        md="4"
        class="d-flex"
      >
        <v-card
          :class="[
            'pricing-card flex-grow-1 d-flex flex-column',
            { 'popular-plan': plan.popular }
          ]"
          :elevation="plan.popular ? 12 : 4"
          rounded="xl"
        >
          <!-- Popular badge -->
          <div
            v-if="plan.popular"
            class="popular-badge"
          >
            <v-chip
              color="success"
              size="small"
              prepend-icon="mdi-star"
            >
              Most Popular
            </v-chip>
          </div>

          <v-card-text class="pa-6 text-center flex-grow-1 d-flex flex-column">
            <!-- Plan header -->
            <div class="mb-6">
              <h3 class="text-h4 font-weight-bold mb-2">
                {{ plan.name }}
              </h3>
              <p class="text-body-1 text-grey-darken-2">
                {{ plan.description }}
              </p>
            </div>

            <!-- Pricing -->
            <div class="mb-6">
              <div class="d-flex align-end justify-center">
                <span class="text-h3 font-weight-bold">
                  ${{ isYearly ? plan.yearlyPrice : plan.monthlyPrice }}
                </span>
                <span class="text-body-1 text-grey-darken-2 ml-2">
                  /{{ isYearly ? 'year' : 'month' }}
                </span>
              </div>
              <div
                v-if="isYearly && plan.monthlyPrice > 0"
                class="text-body-2 text-grey-darken-2 mt-1"
              >
                Billed annually (${{ Math.round(plan.yearlyPrice / 12) }}/month)
              </div>
            </div>

            <!-- Features -->
            <div class="flex-grow-1">
              <v-list class="bg-transparent" density="compact">
                <v-list-item
                  v-for="feature in plan.features"
                  :key="feature"
                  class="px-0"
                >
                  <template #prepend>
                    <v-icon
                      :icon="plan.name === 'Free' && feature.includes('Limited') 
                        ? 'mdi-check-circle-outline' 
                        : 'mdi-check-circle'"
                      :color="plan.name === 'Free' && feature.includes('Limited') 
                        ? 'grey-darken-2' 
                        : 'success'"
                      size="small"
                      class="mr-3"
                    />
                  </template>
                  <v-list-item-title class="text-body-2">
                    {{ feature }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>

            <!-- CTA Button -->
            <div class="mt-6">
              <v-btn
                :color="plan.popular ? 'primary' : 'default'"
                :variant="plan.popular ? 'flat' : 'outlined'"
                size="large"
                block
                :prepend-icon="plan.name === 'Free' ? 'mdi-play' : 'mdi-rocket-launch'"
                @click="selectPlan(plan)"
              >
                {{ plan.ctaText }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      </v-row>

      <!-- FAQ -->
      <v-row justify="center" class="mt-12">
        <v-col cols="12" md="8">
          <div class="text-center mb-8">
            <h3 class="text-h4 font-weight-bold text-white mb-4">
              Frequently Asked Questions
            </h3>
          </div>
          
          <v-expansion-panels
            variant="accordion"
            multiple
            class="pricing-faq"
          >
            <v-expansion-panel
              v-for="(faq, index) in pricingFAQ"
              :key="index"
            >
              <v-expansion-panel-title class="text-h6">
                {{ faq.question }}
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                {{ faq.answer }}
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface PricingPlan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  ctaText: string;
  popular?: boolean;
}

interface FAQ {
  question: string;
  answer: string;
}

const isYearly = ref(false);

const plans: PricingPlan[] = [
  {
    name: 'Free',
    description: 'Perfect for trying out Cloudless',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Up to 3 projects',
      'Basic workflow templates',
      'Community support',
      'Limited data processing (1GB/month)',
      'Standard security'
    ],
    ctaText: 'Get Started Free'
  },
  {
    name: 'Pro',
    description: 'For growing teams and businesses',
    monthlyPrice: 49,
    yearlyPrice: 470,
    features: [
      'Unlimited projects',
      'Advanced workflow templates',
      'Priority email support',
      'Up to 100GB data processing/month',
      'Advanced security & compliance',
      'Team collaboration tools',
      'API access',
      'Custom integrations'
    ],
    ctaText: 'Start Pro Trial',
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 199,
    yearlyPrice: 1910,
    features: [
      'Everything in Pro',
      'Unlimited data processing',
      '24/7 phone & chat support',
      'Dedicated account manager',
      'Custom workflow development',
      'On-premise deployment options',
      'Advanced analytics & reporting',
      'SLA guarantees'
    ],
    ctaText: 'Contact Sales'
  }
];

const pricingFAQ: FAQ[] = [
  {
    question: 'Can I change plans anytime?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and bank transfers for annual plans. Enterprise customers can also pay by invoice.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! Pro and Enterprise plans come with a 14-day free trial. No credit card required to start.'
  },
  {
    question: 'What happens if I exceed my data limits?',
    answer: 'You\'ll receive notifications as you approach your limits. If exceeded, we\'ll temporarily pause processing until you upgrade or the next billing cycle.'
  }
];

const selectPlan = (plan: PricingPlan) => {
  if (plan.name === 'Free') {
    window.location.href = '/auth';
  } else if (plan.name === 'Enterprise') {
    // Open contact form or navigate to contact page
    window.location.href = '/contact';
  } else {
    // Navigate to checkout or trial signup
    window.location.href = '/auth?plan=' + plan.name.toLowerCase();
  }
};
</script>

<style scoped>
.pricing-section {
  background: linear-gradient(135deg, rgba(103, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  backdrop-filter: blur(10px);
}

.pricing-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  position: relative;
}

.pricing-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
}

.popular-plan {
  transform: scale(1.05);
  border: 2px solid #1976d2 !important;
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.pricing-faq {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
}

@media (max-width: 768px) {
  .popular-plan {
    transform: none;
    margin-top: 1rem;
  }
  
  .pricing-card {
    margin-bottom: 2rem;
  }
}
</style>
