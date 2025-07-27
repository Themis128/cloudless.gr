<template>
  <v-card 
    class="pricing-card" 
    hover 
    :elevation="plan.popular ? 8 : 4"
    :class="{ 'popular-card': plan.popular }"
    @click="$emit('select')"
    role="button"
    tabindex="0"
    @keydown.enter="$emit('select')"
    @keydown.space.prevent="$emit('select')"
  >
    <v-card-text class="pa-6">
      <!-- Popular Badge -->
      <div v-if="plan.popular" class="popular-badge">
        <v-chip color="primary" size="small" variant="elevated">
          Most Popular
        </v-chip>
      </div>

      <!-- Plan Header -->
      <div class="text-center mb-6">
        <h3 class="text-h5 font-weight-bold mb-2">
          {{ plan.name }}
        </h3>
        
        <div class="price-display mb-3">
          <span class="currency">$</span>
          <span class="amount">
            {{ isAnnual ? plan.annualPrice : plan.monthlyPrice }}
          </span>
          <span class="period">/{{ isAnnual ? 'year' : 'month' }}</span>
        </div>
        
        <p class="text-body-2 text-medium-emphasis">
          {{ plan.description }}
        </p>
      </div>

      <!-- Plan Features -->
      <div class="features-list mb-6">
        <div 
          v-for="feature in plan.features" 
          :key="feature"
          class="feature-item"
        >
          <v-icon size="20" color="success" class="mr-3">
            mdi-check
          </v-icon>
          <span class="text-body-2">{{ feature }}</span>
        </div>
      </div>

      <!-- Plan Limits -->
      <v-card class="limits-card mb-6" variant="outlined">
        <v-card-text class="pa-4">
          <div 
            v-for="(value, key) in plan.limits" 
            :key="key"
            class="limit-item"
          >
            <span class="limit-label">{{ formatLimitLabel(key) }}</span>
            <span class="limit-value">{{ value }}</span>
          </div>
        </v-card-text>
      </v-card>

      <!-- Action Button -->
      <v-btn
        :color="plan.popular ? 'primary' : 'outlined'"
        :variant="plan.popular ? 'elevated' : 'outlined'"
        size="large"
        block
        :ripple="false"
        :aria-label="`Select ${plan.name} plan`"
      >
        {{ plan.buttonText }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
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

interface Props {
  plan: Plan
  isAnnual: boolean
}

interface Emits {
  (e: 'select'): void
}

defineProps<Props>()
defineEmits<Emits>()

const formatLimitLabel = (key: string): string => {
  const labels: Record<string, string> = {
    apiRequests: 'API Requests',
    bots: 'Bots',
    models: 'Models',
    pipelines: 'Pipelines',
    teamMembers: 'Team Members'
  }
  return labels[key] || key
}
</script>

<style scoped>
.pricing-card {
  height: 100%;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  border-radius: 16px;
  position: relative;
}

.pricing-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
}

.pricing-card:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

.popular-card {
  border: 2px solid var(--v-theme-primary);
  transform: scale(1.02);
}

.popular-card:hover {
  transform: scale(1.02) translateY(-8px);
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.price-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--v-theme-on-surface-variant);
}

.amount {
  font-size: 3rem;
  font-weight: 700;
  color: var(--v-theme-primary);
  line-height: 1;
}

.period {
  font-size: 1rem;
  color: var(--v-theme-on-surface-variant);
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
}

.limits-card {
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.05);
}

.limit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.limit-item:last-child {
  margin-bottom: 0;
}

.limit-label {
  font-size: 0.875rem;
  color: var(--v-theme-on-surface-variant);
}

.limit-value {
  font-weight: 600;
  color: var(--v-theme-on-surface);
}

/* Ensure consistent card heights */
.v-card-text {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .amount {
    font-size: 2.5rem;
  }
  
  .currency {
    font-size: 1.25rem;
  }
}
</style> 