<template>
  <div class="billing-upgrade">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" md="8" lg="6">
          <v-card elevation="3" rounded="lg" class="pa-6">
            <!-- Header -->
            <div class="text-center mb-6">
              <v-icon
                icon="mdi-credit-card"
                size="64"
                color="primary"
                class="mb-4"
              />
              <h1 class="text-h4 font-weight-bold mb-2">
                {{ isDowngrade ? 'Downgrade Plan' : 'Upgrade Your Plan' }}
              </h1>
              <p class="text-body-1 text-medium-emphasis">
                {{ isDowngrade ? 'Confirm your plan downgrade' : 'Complete your upgrade to unlock premium features' }}
              </p>
            </div>

            <!-- Plan Comparison -->
            <v-row class="mb-6">
              <!-- Current Plan -->
              <v-col cols="6">
                <v-card variant="outlined" class="h-100">
                  <v-card-title class="text-center">
                    <div class="text-subtitle-1 text-medium-emphasis">Current</div>
                    <div class="text-h6">{{ currentPlan }}</div>
                  </v-card-title>
                  <v-card-text class="text-center">
                    <div class="text-h5 font-weight-bold">
                      {{ getCurrentPlanPrice() }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Arrow -->
              <v-col cols="12" class="d-flex align-center justify-center py-2">
                <v-icon 
                  :icon="isDowngrade ? 'mdi-arrow-down' : 'mdi-arrow-right'" 
                  size="32" 
                  :color="isDowngrade ? 'warning' : 'success'"
                />
              </v-col>

              <!-- New Plan -->
              <v-col cols="6">
                <v-card 
                  variant="outlined" 
                  :color="isDowngrade ? 'warning' : 'primary'"
                  class="h-100"
                >
                  <v-card-title class="text-center">
                    <div class="text-subtitle-1 text-medium-emphasis">New Plan</div>
                    <div class="text-h6">{{ selectedPlan }}</div>
                  </v-card-title>
                  <v-card-text class="text-center">
                    <div class="text-h5 font-weight-bold">
                      {{ getSelectedPlanPrice() }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Features Comparison -->
            <div class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-4">What's included:</h3>
              <v-list>
                <v-list-item
                  v-for="feature in getSelectedPlanFeatures()"
                  :key="feature.name"
                >
                  <template #prepend>
                    <v-icon 
                      :icon="feature.included ? 'mdi-check-circle' : 'mdi-close-circle'"
                      :color="feature.included ? 'success' : 'error'"
                    />
                  </template>
                  <v-list-item-title>{{ feature.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </div>

            <!-- Billing Summary -->
            <v-card variant="tonal" color="info" class="mb-6">
              <v-card-text>
                <h3 class="text-h6 font-weight-bold mb-3">Billing Summary</h3>
                <div class="d-flex justify-space-between mb-2">
                  <span>{{ selectedPlan }} Plan</span>
                  <span>{{ getSelectedPlanPrice() }}/month</span>
                </div>
                <div v-if="!isDowngrade && prorationAmount > 0" class="d-flex justify-space-between mb-2">
                  <span>Prorated amount</span>
                  <span>${{ prorationAmount.toFixed(2) }}</span>
                </div>
                <v-divider class="my-2" />
                <div class="d-flex justify-space-between font-weight-bold">
                  <span>{{ isDowngrade ? 'New monthly charge' : 'Amount due today' }}</span>
                  <span>{{ isDowngrade ? getSelectedPlanPrice() : `$${getTotalAmount().toFixed(2)}` }}</span>
                </div>
              </v-card-text>
            </v-card>

            <!-- Payment Form (only for upgrades) -->
            <div v-if="!isDowngrade" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-4">Payment Information</h3>
              
              <v-form ref="paymentForm" v-model="paymentValid">
                <v-row>
                  <v-col cols="12">
                    <v-text-field
                      v-model="paymentInfo.cardNumber"
                      label="Card Number"
                      placeholder="1234 5678 9012 3456"
                      prepend-inner-icon="mdi-credit-card"
                      :rules="cardRules"
                      required
                    />
                  </v-col>
                  
                  <v-col cols="6">
                    <v-text-field
                      v-model="paymentInfo.expiryDate"
                      label="MM/YY"
                      placeholder="12/25"
                      :rules="expiryRules"
                      required
                    />
                  </v-col>
                  
                  <v-col cols="6">
                    <v-text-field
                      v-model="paymentInfo.cvv"
                      label="CVV"
                      placeholder="123"
                      :rules="cvvRules"
                      required
                    />
                  </v-col>
                  
                  <v-col cols="12">
                    <v-text-field
                      v-model="paymentInfo.cardName"
                      label="Cardholder Name"
                      placeholder="John Doe"
                      :rules="nameRules"
                      required
                    />
                  </v-col>
                </v-row>
              </v-form>
            </div>

            <!-- Downgrade Warning -->
            <v-alert
              v-if="isDowngrade"
              type="warning"
              variant="tonal"
              class="mb-6"
            >
              <div class="font-weight-bold mb-2">Important:</div>
              <ul class="text-body-2">
                <li>Your account will be downgraded immediately</li>
                <li>Some features may become unavailable</li>
                <li>You can upgrade again at any time</li>
                <li v-if="selectedPlan === 'Free'">No refund will be issued for the current billing period</li>
              </ul>
            </v-alert>

            <!-- Action Buttons -->
            <div class="d-flex flex-column gap-3">
              <v-btn
                :color="isDowngrade ? 'warning' : 'primary'"
                variant="elevated"
                size="large"
                :loading="processing"
                :disabled="!isDowngrade && !paymentValid"
                @click="processPayment"
                block
              >
                {{ isDowngrade ? 'Confirm Downgrade' : `Complete Upgrade - $${getTotalAmount().toFixed(2)}` }}
              </v-btn>

              <v-btn
                variant="outlined"
                @click="goBack"
                block
                :disabled="processing"
              >
                Cancel
              </v-btn>
            </div>

            <!-- Security Notice -->
            <div class="text-center mt-4">
              <div class="d-flex align-center justify-center gap-2 text-caption text-medium-emphasis">
                <v-icon icon="mdi-lock" size="16" />
                <span>Secured by 256-bit SSL encryption</span>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Success Dialog -->
    <v-dialog v-model="showSuccess" max-width="400">
      <v-card>
        <v-card-text class="text-center pa-6">
          <v-icon
            icon="mdi-check-circle"
            size="64"
            color="success"
            class="mb-4"
          />
          <h3 class="text-h6 font-weight-bold mb-2">
            {{ isDowngrade ? 'Downgrade Complete!' : 'Upgrade Successful!' }}
          </h3>
          <p class="text-body-2 text-medium-emphasis">
            {{ isDowngrade 
              ? `Your plan has been changed to ${selectedPlan}.`
              : `Welcome to the ${selectedPlan} plan! You now have access to all premium features.`
            }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="primary"
            variant="elevated"
            block
            @click="goToDashboard"
          >
            Go to Dashboard
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['06-auth-required'],
  layout: 'default'
})

useSeoMeta({
  title: 'Billing Upgrade - Cloudless.gr',
  description: 'Upgrade your plan to unlock premium features.',
})

const route = useRoute()
const router = useRouter()
const user = useSupabaseUser()

// Reactive state
const processing = ref(false)
const paymentValid = ref(false)
const showSuccess = ref(false)

// Get plan from route query
const selectedPlan = computed(() => {
  const plan = route.query.plan as string || 'pro'
  return plan.charAt(0).toUpperCase() + plan.slice(1)
})

const isDowngrade = computed(() => route.query.action === 'downgrade')

// Get current user plan
const currentPlan = computed(() => {
  if (!user.value) return 'Free'
  
  const metadata = user.value.user_metadata || {}
  const appMetadata = user.value.app_metadata || {}
  const plan = metadata.plan || appMetadata.plan || 'free'
  
  return plan.charAt(0).toUpperCase() + plan.slice(1)
})

// Payment form data
const paymentInfo = ref({
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  cardName: ''
})

// Validation rules
const cardRules = [
  (v: string) => !!v || 'Card number is required',
  (v: string) => v.length >= 16 || 'Card number must be at least 16 digits'
]

const expiryRules = [
  (v: string) => !!v || 'Expiry date is required',
  (v: string) => /^\d{2}\/\d{2}$/.test(v) || 'Format must be MM/YY'
]

const cvvRules = [
  (v: string) => !!v || 'CVV is required',
  (v: string) => v.length >= 3 || 'CVV must be at least 3 digits'
]

const nameRules = [
  (v: string) => !!v || 'Cardholder name is required'
]

// Plan pricing
const planPrices = {
  'Free': 0,
  'Pro': 19,
  'Business': 49
}

const getCurrentPlanPrice = () => {
  const price = planPrices[currentPlan.value as keyof typeof planPrices] || 0
  return price === 0 ? 'Free' : `$${price}/month`
}

const getSelectedPlanPrice = () => {
  const price = planPrices[selectedPlan.value as keyof typeof planPrices] || 0
  return price === 0 ? 'Free' : `$${price}/month`
}

// Calculate proration (simplified)
const prorationAmount = computed(() => {
  if (isDowngrade.value) return 0
  
  const currentPrice = planPrices[currentPlan.value as keyof typeof planPrices] || 0
  const selectedPrice = planPrices[selectedPlan.value as keyof typeof planPrices] || 0
  
  // Simplified proration calculation (in reality this would be more complex)
  const daysRemaining = 15 // Example: 15 days remaining in billing period
  const dailyDifference = (selectedPrice - currentPrice) / 30
  
  return Math.max(0, dailyDifference * daysRemaining)
})

const getTotalAmount = () => {
  const selectedPrice = planPrices[selectedPlan.value as keyof typeof planPrices] || 0
  return selectedPrice + prorationAmount.value
}

// Plan features
const getSelectedPlanFeatures = () => {
  const planFeatures = {
    'Free': [
      { name: '5 Projects', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Community Support', included: true },
      { name: 'Advanced Analytics', included: false },
      { name: 'Priority Support', included: false },
      { name: 'Custom Integrations', included: false }
    ],
    'Pro': [
      { name: 'Unlimited Projects', included: true },
      { name: 'Advanced Analytics', included: true },
      { name: 'Priority Support', included: true },
      { name: 'Custom Integrations', included: true },
      { name: 'API Access', included: true },
      { name: 'Team Management', included: false },
      { name: 'Advanced Security', included: false }
    ],
    'Business': [
      { name: 'Everything in Pro', included: true },
      { name: 'Team Management', included: true },
      { name: 'Advanced Security', included: true },
      { name: 'SSO Integration', included: true },
      { name: 'White Label Options', included: true },
      { name: '24/7 Phone Support', included: true }
    ]
  }
  
  return planFeatures[selectedPlan.value as keyof typeof planFeatures] || []
}

const processPayment = async () => {
  processing.value = true
  
  try {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // In a real app, this would:
    // 1. Process payment with Stripe/Paddle
    // 2. Update user plan in database
    // 3. Send confirmation email
    
    showSuccess.value = true
  } catch (error) {
    console.error('Payment failed:', error)
    // Handle payment error
  } finally {
    processing.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToDashboard = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.billing-upgrade {
  padding: 2rem 0;
  min-height: 100vh;
}
</style>
