<template>
  <div class="pricing-page">
    <div class="page-header">
      <h1>Pricing Plans</h1>
      <p class="subtitle">
        Choose the perfect plan for your needs
      </p>
    </div>

    <div class="content-grid">
      <div class="pricing-toggle">
        <span class="toggle-label">Billing</span>
        <v-switch
          v-model="isAnnual"
          :label="isAnnual ? 'Annual (Save 20%)' : 'Monthly'"
          color="primary"
          hide-details
        />
      </div>

      <div class="plans-grid">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="plan-card"
          :class="{ popular: plan.popular }"
        >
          <div class="plan-header">
            <h3>{{ plan.name }}</h3>
            <div class="plan-price">
              <span class="currency">$</span>
              <span class="amount">{{
                isAnnual ? plan.annualPrice : plan.monthlyPrice
              }}</span>
              <span class="period">/{{ isAnnual ? 'year' : 'month' }}</span>
            </div>
            <p class="plan-description">
              {{ plan.description }}
            </p>
          </div>

          <div class="plan-features">
            <div
              v-for="feature in plan.features"
              :key="feature"
              class="feature"
            >
              <v-icon size="20" color="success">
                mdi-check
              </v-icon>
              <span>{{ feature }}</span>
            </div>
          </div>

          <div class="plan-limits">
            <div class="limit-item">
              <span class="limit-label">API Requests</span>
              <span class="limit-value">{{ plan.limits.apiRequests }}/month</span>
            </div>
            <div class="limit-item">
              <span class="limit-label">Bots</span>
              <span class="limit-value">{{ plan.limits.bots }}</span>
            </div>
            <div class="limit-item">
              <span class="limit-label">Models</span>
              <span class="limit-value">{{ plan.limits.models }}</span>
            </div>
            <div class="limit-item">
              <span class="limit-label">Pipelines</span>
              <span class="limit-value">{{ plan.limits.pipelines }}</span>
            </div>
            <div class="limit-item">
              <span class="limit-label">Team Members</span>
              <span class="limit-value">{{ plan.limits.teamMembers }}</span>
            </div>
          </div>

          <v-btn
            :color="plan.popular ? 'primary' : 'outlined'"
            :variant="plan.popular ? 'elevated' : 'outlined'"
            size="large"
            class="plan-button"
            block
          >
            {{ plan.buttonText }}
          </v-btn>
        </div>
      </div>

      <div class="enterprise-section">
        <div class="enterprise-card">
          <div class="enterprise-content">
            <h2>Enterprise</h2>
            <p>
              Need a custom solution? Our enterprise plan includes dedicated
              support, custom integrations, and unlimited resources for large
              organizations.
            </p>
            <div class="enterprise-features">
              <div class="enterprise-feature">
                <v-icon size="24" color="primary">
                  mdi-shield-check
                </v-icon>
                <span>Custom Security & Compliance</span>
              </div>
              <div class="enterprise-feature">
                <v-icon size="24" color="primary">
                  mdi-headset
                </v-icon>
                <span>24/7 Dedicated Support</span>
              </div>
              <div class="enterprise-feature">
                <v-icon size="24" color="primary">
                  mdi-cog
                </v-icon>
                <span>Custom Integrations</span>
              </div>
              <div class="enterprise-feature">
                <v-icon size="24" color="primary">
                  mdi-account-group
                </v-icon>
                <span>Unlimited Team Members</span>
              </div>
            </div>
            <v-btn
              color="primary"
              variant="elevated"
              size="large"
              class="enterprise-btn"
            >
              Contact Sales
            </v-btn>
          </div>
        </div>
      </div>

      <div class="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-grid">
          <div class="faq-item">
            <h3>Can I change plans anytime?</h3>
            <p>
              Yes! You can upgrade or downgrade your plan at any time. Changes
              take effect immediately, and we'll prorate any billing
              adjustments.
            </p>
          </div>

          <div class="faq-item">
            <h3>What happens if I exceed my limits?</h3>
            <p>
              We'll notify you when you're approaching your limits. You can
              either upgrade your plan or purchase additional usage credits to
              continue without interruption.
            </p>
          </div>

          <div class="faq-item">
            <h3>Do you offer refunds?</h3>
            <p>
              We offer a 30-day money-back guarantee for all paid plans. If
              you're not satisfied, we'll refund your payment in full.
            </p>
          </div>

          <div class="faq-item">
            <h3>Is there a free trial?</h3>
            <p>
              Yes! All paid plans come with a 14-day free trial. No credit card
              required to start your trial.
            </p>
          </div>
        </div>
      </div>

      <div class="comparison-section">
        <h2>Plan Comparison</h2>
        <div class="comparison-table">
          <div class="table-header">
            <div class="header-cell">
              Feature
            </div>
            <div class="header-cell">
              Free
            </div>
            <div class="header-cell">
              Pro
            </div>
            <div class="header-cell">
              Business
            </div>
          </div>

          <div
            v-for="feature in comparisonFeatures"
            :key="feature.name"
            class="table-row"
          >
            <div class="feature-cell">
              {{ feature.name }}
            </div>
            <div class="value-cell">
              <v-icon v-if="feature.free" size="20" color="success">
                mdi-check
              </v-icon>
              <span v-else-if="typeof feature.free === 'string'">{{
                feature.free
              }}</span>
              <v-icon v-else size="20" color="error">
                mdi-close
              </v-icon>
            </div>
            <div class="value-cell">
              <v-icon v-if="feature.pro" size="20" color="success">
                mdi-check
              </v-icon>
              <span v-else-if="typeof feature.pro === 'string'">{{
                feature.pro
              }}</span>
              <v-icon v-else size="20" color="error">
                mdi-close
              </v-icon>
            </div>
            <div class="value-cell">
              <v-icon v-if="feature.business" size="20" color="success">
                mdi-check
              </v-icon>
              <span v-else-if="typeof feature.business === 'string'">{{
                feature.business
              }}</span>
              <v-icon v-else size="20" color="error">
                mdi-close
              </v-icon>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isAnnual = ref(false)

const plans = [
  {
    name: 'Free',
    description: 'Perfect for getting started and small projects',
    monthlyPrice: 0,
    annualPrice: 0,
    popular: false,
    buttonText: 'Get Started Free',
    features: [
      '5 bots',
      '2 models',
      '3 pipelines',
      '1,000 API requests/month',
      'Basic support',
      'Community forum access',
    ],
    limits: {
      apiRequests: '1,000',
      bots: 5,
      models: 2,
      pipelines: 3,
      teamMembers: 1,
    },
  },
  {
    name: 'Pro',
    description: 'Ideal for growing teams and businesses',
    monthlyPrice: 29,
    annualPrice: 279,
    popular: true,
    buttonText: 'Start Free Trial',
    features: [
      'Unlimited bots',
      '10 models',
      'Unlimited pipelines',
      '100,000 API requests/month',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
      'Team collaboration',
    ],
    limits: {
      apiRequests: '100,000',
      bots: 'Unlimited',
      models: 10,
      pipelines: 'Unlimited',
      teamMembers: 5,
    },
  },
  {
    name: 'Business',
    description: 'For large organizations with advanced needs',
    monthlyPrice: 99,
    annualPrice: 949,
    popular: false,
    buttonText: 'Start Free Trial',
    features: [
      'Everything in Pro',
      'Unlimited models',
      '1M API requests/month',
      'Dedicated support',
      'Custom branding',
      'Advanced security',
      'SLA guarantee',
      'White-label options',
    ],
    limits: {
      apiRequests: '1,000,000',
      bots: 'Unlimited',
      models: 'Unlimited',
      pipelines: 'Unlimited',
      teamMembers: 25,
    },
  },
]

const comparisonFeatures = [
  {
    name: 'API Requests',
    free: '1K/month',
    pro: '100K/month',
    business: '1M/month',
  },
  { name: 'Bots', free: 5, pro: true, business: true },
  { name: 'Models', free: 2, pro: 10, business: true },
  { name: 'Pipelines', free: 3, pro: true, business: true },
  { name: 'Team Members', free: 1, pro: 5, business: 25 },
  { name: 'Priority Support', free: false, pro: true, business: true },
  { name: 'Advanced Analytics', free: false, pro: true, business: true },
  { name: 'Custom Integrations', free: false, pro: true, business: true },
  { name: 'Custom Branding', free: false, pro: false, business: true },
  { name: 'SLA Guarantee', free: false, pro: false, business: true },
]
</script>

<style scoped>
.pricing-page {
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

.pricing-toggle {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.toggle-label {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.7);
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
}

.plan-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  position: relative;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.plan-card.popular {
  border: 2px solid #667eea;
  transform: scale(1.05);
}

.plan-card.popular::before {
  content: 'Most Popular';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.plan-header {
  text-align: center;
  margin-bottom: 2rem;
}

.plan-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

.amount {
  font-size: 3rem;
  font-weight: 700;
  color: #667eea;
}

.period {
  font-size: 1rem;
  color: rgba(0, 0, 0, 0.5);
}

.plan-description {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

.plan-features {
  margin-bottom: 2rem;
}

.feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: rgba(0, 0, 0, 0.7);
}

.plan-limits {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.limit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.limit-item:last-child {
  margin-bottom: 0;
}

.limit-label {
  color: rgba(0, 0, 0, 0.7);
  font-size: 0.9rem;
}

.limit-value {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
}

.plan-button {
  width: 100%;
}

.enterprise-section {
  text-align: center;
}

.enterprise-card {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  );
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 20px;
  padding: 3rem;
  max-width: 800px;
  margin: 0 auto;
}

.enterprise-content h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.enterprise-content p {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.7;
  margin-bottom: 2rem;
}

.enterprise-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.enterprise-feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: rgba(0, 0, 0, 0.7);
}

.enterprise-btn {
  min-width: 200px;
}

.faq-section {
  text-align: center;
}

.faq-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
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
  text-align: left;
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

.comparison-section {
  text-align: center;
}

.comparison-section h2 {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 2rem;
}

.comparison-table {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  background: rgba(102, 126, 234, 0.1);
}

.header-cell {
  padding: 1.5rem 1rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.table-row:last-child {
  border-bottom: none;
}

.feature-cell {
  padding: 1rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.9);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
}

.value-cell {
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.7);
}

@media (max-width: 768px) {
  .pricing-page {
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

  .plans-grid {
    grid-template-columns: 1fr;
  }

  .plan-card {
    padding: 2rem;
  }

  .plan-card.popular {
    transform: none;
  }

  .enterprise-features {
    grid-template-columns: 1fr;
  }

  .faq-grid {
    grid-template-columns: 1fr;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
  }

  .feature-cell {
    border-right: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .value-cell {
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
}
</style>
