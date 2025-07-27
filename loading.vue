<template>
  <div class="loading-page">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" md="6" lg="4" class="text-center">
          <v-card class="loading-card" elevation="8" rounded="xl">
            <v-card-text class="pa-8">
              <!-- Loading Animation -->
              <div class="loading-animation mb-6">
                <div class="loading-spinner">
                  <v-progress-circular
                    indeterminate
                    size="80"
                    width="8"
                    color="primary"
                  />
                </div>
                <div class="loading-dots">
                  <div class="dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }"></div>
                </div>
              </div>

              <!-- Loading Title -->
              <h2 class="text-h4 font-weight-bold mb-4">
                {{ loadingTitle }}
              </h2>

              <!-- Loading Message -->
              <p class="text-body-1 text-medium-emphasis mb-6">
                {{ loadingMessage }}
              </p>

              <!-- Progress Bar (if available) -->
              <v-progress-linear
                v-if="progress > 0"
                :model-value="progress"
                color="primary"
                height="4"
                rounded
                class="mb-4"
              />

              <!-- Loading Tips -->
              <v-expand-transition>
                <div v-if="showTips" class="loading-tips">
                  <v-alert type="info" variant="tonal" class="mb-4">
                    <template #title>
                      <strong>Loading Tips</strong>
                    </template>
                    <ul class="tips-list">
                      <li>Check your internet connection</li>
                      <li>Try refreshing the page</li>
                      <li>Clear your browser cache</li>
                    </ul>
                  </v-alert>
                </div>
              </v-expand-transition>

              <!-- Cancel Button -->
              <v-btn
                v-if="showCancel"
                color="secondary"
                variant="outlined"
                size="small"
                @click="cancelLoading"
                class="mt-4"
              >
                Cancel
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
interface LoadingProps {
  loading?: boolean
  progress?: number
  title?: string
  message?: string
  showTips?: boolean
  showCancel?: boolean
}

const props = withDefaults(defineProps<LoadingProps>(), {
  loading: true,
  progress: 0,
  title: 'Loading',
  message: 'Please wait while we prepare your content...',
  showTips: false,
  showCancel: false
})

// Computed properties
const loadingTitle = computed(() => props.title)
const loadingMessage = computed(() => props.message)

// Methods
const cancelLoading = () => {
  // In a real app, you might want to cancel the current operation
  // For now, we'll just navigate back
  if (process.client) {
    window.history.back()
  }
}

// Auto-show tips after 5 seconds if loading takes too long
const showTipsAfterDelay = ref(false)
onMounted(() => {
  if (props.showTips) {
    setTimeout(() => {
      showTipsAfterDelay.value = true
    }, 5000)
  }
})

// Set page title
useHead({
  title: `${loadingTitle.value} - Cloudless`,
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})
</script>

<style scoped>
.loading-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.loading-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.loading-animation {
  position: relative;
}

.loading-spinner {
  margin-bottom: 1rem;
}

.loading-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--v-primary-base);
  animation: bounce 1.4s ease-in-out infinite both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.tips-list {
  margin: 0;
  padding-left: 1.5rem;
  text-align: left;
}

.tips-list li {
  margin-bottom: 0.5rem;
  color: var(--v-on-surface-variant);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .loading-card {
    margin: 1rem;
  }

  h2 {
    font-size: 1.5rem !important;
  }

  p {
    font-size: 0.875rem !important;
  }
}

/* Loading state animations */
.loading-card {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
