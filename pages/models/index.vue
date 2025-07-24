<template>
  <div>
    <LayoutPageStructure
      title="Models"
      subtitle="Manage and deploy your trained AI models"
      back-button-to="/"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis">
                  Create, train, deploy, or test models
                </p>
              </div>
            </div>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  to="/models/create"
                  color="primary"
                  prepend-icon="mdi-plus"
                  variant="elevated"
                  class="action-btn w-100"
                  size="large"
                  height="80"
                >
                  <div class="d-flex flex-column align-center">
                    <span class="text-h6">Create Model</span>
                    <span class="text-caption">Build new AI models</span>
                  </div>
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  to="/models/train"
                  color="secondary"
                  prepend-icon="mdi-school"
                  variant="elevated"
                  class="action-btn w-100"
                  size="large"
                  height="80"
                >
                  <div class="d-flex flex-column align-center">
                    <span class="text-h6">Train Model</span>
                    <span class="text-caption">Train existing models</span>
                  </div>
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  to="/models/deploy"
                  color="success"
                  prepend-icon="mdi-rocket-launch"
                  variant="elevated"
                  class="action-btn w-100"
                  size="large"
                  height="80"
                >
                  <div class="d-flex flex-column align-center">
                    <span class="text-h6">Deploy Model</span>
                    <span class="text-caption">Deploy to production</span>
                  </div>
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  to="/models/test"
                  color="info"
                  prepend-icon="mdi-play-circle"
                  variant="elevated"
                  class="action-btn w-100"
                  size="large"
                  height="80"
                >
                  <div class="d-flex flex-column align-center">
                    <span class="text-h6">Test Model</span>
                    <span class="text-caption">Test model performance</span>
                  </div>
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Model Analytics -->
        <ModelsModelAnalytics class="mb-4" />

        <!-- Enhanced Models List -->
        <ModelsModelListEnhanced />

        <!-- Error Alert -->
        <v-alert 
          v-if="modelStore.hasError" 
          type="error" 
          class="mt-4"
          role="alert"
          aria-live="polite"
        >
          <template #prepend>
            <v-icon>mdi-alert-circle</v-icon>
          </template>
          {{ modelStore.error }}
        </v-alert>

        <!-- Success Alert -->
        <v-alert 
          v-if="modelStore.hasSuccess" 
          type="success" 
          class="mt-4"
          role="alert"
          aria-live="polite"
        >
          <template #prepend>
            <v-icon>mdi-check-circle</v-icon>
          </template>
          {{ modelStore.success }}
        </v-alert>
      </template>

      <template #sidebar>
        <ModelGuide />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import { useModelStore } from '~/stores/modelStore'

// SEO Meta Tags
useHead({
  title: 'AI Models - Cloudless',
  meta: [
    { name: 'description', content: 'Manage and deploy your trained AI models with our comprehensive platform.' },
    { property: 'og:title', content: 'AI Models - Cloudless' },
    { property: 'og:description', content: 'Manage and deploy your trained AI models' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'AI Models - Cloudless' },
    { name: 'twitter:description', content: 'Manage and deploy your trained AI models' }
  ]
})

// Page Meta
definePageMeta({
  title: 'AI Models',
  description: 'Manage and deploy your trained AI models'
})

// Types
interface Model {
  id: number
  name: string
  description?: string
  status: string
  type: string
  createdAt: Date
  updatedAt: Date
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}

// Server-side data fetching
const { data: modelsData, error: modelsError, pending, refresh } = await useFetch<ApiResponse<Model[]>>('/api/models', {
  default: () => ({ success: true, data: [], message: '' }),
  transform: (response: ApiResponse<Model[]>) => response.data,
  onResponseError({ response }: { response: { _data: any } }) {
    console.error('Models fetch error:', response._data)
  }
})

// Error handling
if (modelsError.value) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to load models data'
  })
}

// Store integration
const modelStore = useModelStore()

// Computed properties
const hasModelsData = computed(() => !!modelsData.value?.length)
const isLoading = computed(() => pending.value || modelStore.loading)

// Client-side initialization (fallback)
onMounted(() => {
  if (!hasModelsData.value) {
    modelStore.fetchAll()
  }
})

// Watch for store changes
watch(() => modelStore.error, (error) => {
  if (error) {
    console.error('Model store error:', error)
  }
})

watch(() => modelStore.success, (success) => {
  if (success) {
    console.log('Model store success:', success)
  }
})

// Watch for data changes
watch(modelsData, (newData) => {
  if (newData && newData.length > 0) {
    console.log('Models data updated:', newData.length, 'models')
  }
}, { immediate: true })
</script>

<style scoped>
.quick-actions-header {
  margin-bottom: 1.5rem;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

/* Vuetify 3 responsive improvements */
@media (max-width: 600px) {
  .action-btn {
    height: 60px !important;
  }
  
  .action-btn .text-h6 {
    font-size: 1rem !important;
  }
  
  .action-btn .text-caption {
    font-size: 0.75rem !important;
  }
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.models-list {
  background: transparent;
}

.model-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease-in-out;
}

.model-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gap-4 {
  gap: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .quick-actions-buttons {
    grid-template-columns: 1fr;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>
