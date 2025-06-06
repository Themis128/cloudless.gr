<template>
  <div class="pricing-page">
    <v-container>
      <!-- Header Section -->
      <v-row justify="center" class="mb-8">
        <v-col cols="12" md="8" lg="6" class="text-center">
          <h1 class="text-h2 font-weight-bold mb-4 text-primary">
            Choose Your Plan
          </h1>
          <p class="text-h6 text-medium-emphasis">
            Select the perfect plan for your needs. Upgrade or downgrade at any time.
          </p>
        </v-col>
      </v-row>

      <!-- Pricing Cards -->
      <v-row justify="center" class="mb-8">
        <!-- Free Plan -->
        <v-col cols="12" md="4" class="mb-4">
          <v-card
            elevation="2"
            class="h-100 pricing-card"
            :class="{ 'current-plan': currentPlan === 'Free' }"
          >
            <v-card-title class="text-center pt-6">
              <div class="d-flex align-center justify-center mb-2">
                <v-icon icon="mdi-account" class="me-2" />
                <span>Free</span>
              </div>
              <div class="text-h3 font-weight-bold">
                $0<span class="text-body-1">/month</span>
              </div>
            </v-card-title>
            
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>5 Projects</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Basic Analytics</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Community Support</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Standard Templates</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>

            <v-card-actions class="pa-4">
              <v-btn
                v-if="currentPlan !== 'Free'"
                variant="outlined"
                block
                @click="downgradeTo('free')"
              >
                Downgrade to Free
              </v-btn>
              <v-chip v-else color="success" variant="tonal" class="mx-auto">
                <v-icon start icon="mdi-check" />
                Current Plan
              </v-chip>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Pro Plan -->
        <v-col cols="12" md="4" class="mb-4">
          <v-card
            elevation="4"
            class="h-100 pricing-card featured"
            :class="{ 'current-plan': currentPlan === 'Pro' }"
          >
            <v-chip
              color="primary"
              class="popular-badge"
              size="small"
            >
              Most Popular
            </v-chip>
            
            <v-card-title class="text-center pt-6">
              <div class="d-flex align-center justify-center mb-2">
                <v-icon icon="mdi-star" class="me-2" />
                <span>Pro</span>
              </div>
              <div class="text-h3 font-weight-bold text-primary">
                $19<span class="text-body-1">/month</span>
              </div>
            </v-card-title>
            
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Unlimited Projects</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Advanced Analytics</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Priority Support</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Custom Integrations</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Premium Templates</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>API Access</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>

            <v-card-actions class="pa-4">
              <v-btn
                v-if="currentPlan !== 'Pro'"
                color="primary"
                variant="elevated"
                block
                @click="upgradeTo('pro')"
              >
                Upgrade to Pro
              </v-btn>
              <v-chip v-else color="success" variant="tonal" class="mx-auto">
                <v-icon start icon="mdi-check" />
                Current Plan
              </v-chip>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Business Plan -->
        <v-col cols="12" md="4" class="mb-4">
          <v-card
            elevation="2"
            class="h-100 pricing-card"
            :class="{ 'current-plan': currentPlan === 'Business' }"
          >
            <v-card-title class="text-center pt-6">
              <div class="d-flex align-center justify-center mb-2">
                <v-icon icon="mdi-office-building" class="me-2" />
                <span>Business</span>
              </div>
              <div class="text-h3 font-weight-bold text-warning">
                $49<span class="text-body-1">/month</span>
              </div>
            </v-card-title>
            
            <v-card-text>
              <v-list density="compact">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Everything in Pro</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Team Management</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>Advanced Security</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>SSO Integration</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>White Label Options</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-check" color="success" />
                  </template>
                  <v-list-item-title>24/7 Phone Support</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>

            <v-card-actions class="pa-4">
              <v-btn
                v-if="currentPlan !== 'Business'"
                color="warning"
                variant="elevated"
                block
                @click="upgradeTo('business')"
              >
                Upgrade to Business
              </v-btn>
              <v-chip v-else color="success" variant="tonal" class="mx-auto">
                <v-icon start icon="mdi-check" />
                Current Plan
              </v-chip>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- FAQ Section -->
      <v-row justify="center">
        <v-col cols="12" md="8">
          <div class="text-center mb-6">
            <h2 class="text-h4 font-weight-bold mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>
                Can I change my plan at any time?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                What payment methods do you accept?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                We accept all major credit cards (Visa, MasterCard, American Express) and PayPal.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                Is there a free trial available?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                All paid plans come with a 14-day free trial. You can cancel anytime during the trial period without being charged.
              </v-expansion-panel-text>
            </v-expansion-panel>

            <v-expansion-panel>
              <v-expansion-panel-title>
                What happens to my data if I downgrade?
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                Your data is always safe. If you exceed the limits of a lower plan, you'll have read-only access until you upgrade again or remove excess data.
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-col>
      </v-row>

      <!-- Contact Section -->
      <v-row justify="center" class="mt-8">
        <v-col cols="12" md="6" class="text-center">
          <h3 class="text-h5 font-weight-bold mb-4">
            Need a Custom Plan?
          </h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Contact our sales team for enterprise solutions and custom pricing.
          </p>
          <v-btn
            color="primary"
            variant="outlined"
            href="mailto:sales@cloudless.gr"
            prepend-icon="mdi-email"
          >
            Contact Sales
          </v-btn>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Pricing - Cloudless.gr',
  description: 'Choose the perfect plan for your needs. Free, Pro, and Business plans available with flexible pricing.',
})

const router = useRouter()
const user = useSupabaseUser()

// Get current user plan
const currentPlan = computed(() => {
  if (!user.value) return 'Free'
  
  const metadata = user.value.user_metadata || {}
  const appMetadata = user.value.app_metadata || {}
  const plan = metadata.plan || appMetadata.plan || 'free'
  
  return plan.charAt(0).toUpperCase() + plan.slice(1)
})

const upgradeTo = (plan: string) => {
  // Redirect to billing upgrade page with selected plan
  router.push(`/billing/upgrade?plan=${plan}`)
}

const downgradeTo = (plan: string) => {
  // In a real app, this would show a confirmation dialog
  // and process the downgrade
  router.push(`/billing/upgrade?plan=${plan}&action=downgrade`)
}
</script>

<style scoped>
.pricing-page {
  padding: 2rem 0;
}

.pricing-card {
  position: relative;
  transition: transform 0.3s ease;
}

.pricing-card:hover {
  transform: translateY(-5px);
}

.pricing-card.featured {
  border: 2px solid rgb(var(--v-theme-primary));
}

.pricing-card.current-plan {
  border: 2px solid rgb(var(--v-theme-success));
}

.popular-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}
</style>
