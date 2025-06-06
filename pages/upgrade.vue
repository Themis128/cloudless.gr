<template>
  <div class="d-flex align-center justify-center fill-height">
    <v-container class="text-center">
      <v-row justify="center">
        <v-col cols="12" sm="10" md="8" lg="6">
          <v-card elevation="3" rounded="lg" class="pa-8">
            <!-- Upgrade Icon -->
            <v-icon
              icon="mdi-rocket-launch"
              size="80"
              color="primary"
              class="mb-4"
            />

            <!-- Title -->
            <h1 class="text-h4 font-weight-bold mb-4 text-primary">
              Upgrade Required
            </h1>

            <!-- Dynamic Message based on reason -->
            <div v-if="reason === 'pro-required'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                This feature requires a <strong>Pro plan</strong> or higher.
              </p>
              <v-chip color="success" variant="tonal" class="mb-4">
                <v-icon start icon="mdi-star" />
                Pro Feature
              </v-chip>
            </div>

            <div v-else-if="reason === 'business-required'">
              <p class="text-body-1 text-medium-emphasis mb-4">
                This feature requires a <strong>Business plan</strong> or higher.
              </p>
              <v-chip color="warning" variant="tonal" class="mb-4">
                <v-icon start icon="mdi-office-building" />
                Business Feature
              </v-chip>
            </div>

            <div v-else>
              <p class="text-body-1 text-medium-emphasis mb-4">
                Upgrade your plan to access premium features.
              </p>
              <v-chip color="primary" variant="tonal" class="mb-4">
                <v-icon start icon="mdi-crown" />
                Premium Feature
              </v-chip>
            </div>

            <!-- Current Plan Display -->
            <v-card variant="tonal" color="info" class="mb-6">
              <v-card-text>
                <div class="d-flex align-center justify-center">
                  <v-icon icon="mdi-account-circle" class="me-2" />
                  <span>Current Plan: <strong>{{ currentPlan }}</strong></span>
                </div>
              </v-card-text>
            </v-card>

            <!-- Pricing Plans -->
            <v-row class="mb-6">
              <v-col cols="12" md="6">
                <v-card 
                  variant="outlined" 
                  :color="reason === 'pro-required' ? 'primary' : 'default'"
                  :class="{ 'border-primary': reason === 'pro-required' }"
                >
                  <v-card-title class="text-center">
                    <v-icon icon="mdi-star" class="me-2" />
                    Pro Plan
                  </v-card-title>
                  <v-card-text class="text-center">
                    <div class="text-h4 font-weight-bold text-primary mb-2">
                      $19<span class="text-body-2">/month</span>
                    </div>
                    <v-list density="compact">
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Advanced Analytics
                      </v-list-item>
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Priority Support
                      </v-list-item>
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Custom Integrations
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="6">
                <v-card 
                  variant="outlined"
                  :color="reason === 'business-required' ? 'warning' : 'default'"
                  :class="{ 'border-warning': reason === 'business-required' }"
                >
                  <v-card-title class="text-center">
                    <v-icon icon="mdi-office-building" class="me-2" />
                    Business Plan
                  </v-card-title>
                  <v-card-text class="text-center">
                    <div class="text-h4 font-weight-bold text-warning mb-2">
                      $49<span class="text-body-2">/month</span>
                    </div>
                    <v-list density="compact">
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Everything in Pro
                      </v-list-item>
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Team Management
                      </v-list-item>
                      <v-list-item>
                        <v-icon icon="mdi-check" color="success" class="me-2" />
                        Advanced Security
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Actions -->
            <div class="d-flex flex-column gap-3">
              <v-btn
                color="primary"
                variant="elevated"
                size="large"
                @click="handleUpgrade"
                block
                prepend-icon="mdi-credit-card"
              >
                Upgrade Now
              </v-btn>

              <v-btn
                variant="outlined"
                @click="goToDashboard"
                block
                prepend-icon="mdi-arrow-left"
              >
                Back to Dashboard
              </v-btn>

              <v-btn
                variant="text"
                href="/pricing"
                block
                prepend-icon="mdi-information"
              >
                View Full Pricing
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['06-auth-required'], // User must be logged in to see upgrade page
  layout: 'default'
})

useSeoMeta({
  title: 'Upgrade Your Plan - Cloudless.gr',
  description: 'Upgrade to Pro or Business plan to unlock premium features.',
})

const route = useRoute()
const router = useRouter()
const user = useSupabaseUser()

// Get the reason for upgrade requirement
const reason = computed(() => route.query.reason as string || 'general')

// Get current user plan
const currentPlan = computed(() => {
  if (!user.value) return 'Free'
  
  const metadata = user.value.user_metadata || {}
  const appMetadata = user.value.app_metadata || {}
  const plan = metadata.plan || appMetadata.plan || 'free'
  
  return plan.charAt(0).toUpperCase() + plan.slice(1)
})

const handleUpgrade = () => {
  // Redirect to billing/checkout page
  // In a real app, this would integrate with Stripe, Paddle, etc.
  router.push('/billing/upgrade')
}

const goToDashboard = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}

.border-primary {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
}

.border-warning {
  border: 2px solid rgb(var(--v-theme-warning)) !important;
}
</style>
