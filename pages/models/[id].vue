<template>
  <div>
    <PageStructure
      :title="model?.name || 'Model Details'"
      subtitle="View detailed information about your model"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <p class="mt-2 text-body-2">
            Loading model details...
          </p>
        </div>

        <!-- Error State -->
        <v-alert v-else-if="error" type="error" class="mb-4">
          {{ error }}
        </v-alert>

        <!-- Model Details -->
        <div v-else-if="model" class="model-details">
          <!-- Model Overview Card -->
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-avatar color="primary" size="40" class="mr-3">
                  <v-icon color="white">
                    {{ getModelIcon(model.type) }}
                  </v-icon>
                </v-avatar>
                <div>
                  <h2 class="text-h5 mb-1">
                    {{ model.name }}
                  </h2>
                  <div class="d-flex align-center gap-2">
                    <v-chip
                      :color="getStatusColor(model.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ model.status || 'draft' }}
                    </v-chip>
                    <span class="text-body-2 text-medium-emphasis">
                      v{{ model.version || '1.0.0' }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-pencil"
                  @click="editModel"
                >
                  Edit Model
                </v-btn>
                <v-btn
                  color="error"
                  variant="outlined"
                  prepend-icon="mdi-delete"
                  @click="deleteModel"
                >
                  Delete Model
                </v-btn>
                <v-btn
                  v-if="model.status === 'ready'"
                  color="success"
                  variant="elevated"
                  prepend-icon="mdi-rocket-launch"
                  @click="deployModel"
                >
                  Deploy
                </v-btn>
                <v-btn
                  v-if="model.status === 'draft'"
                  color="secondary"
                  variant="elevated"
                  prepend-icon="mdi-school"
                  @click="trainModel"
                >
                  Train
                </v-btn>
              </div>
            </v-card-title>
            <v-divider />
            <v-card-text>
              <p v-if="model.description" class="text-body-1 mb-4">
                {{ model.description }}
              </p>
              <v-row>
                <v-col cols="12" md="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title>Model Type</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ model.type || 'Custom' }}
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Framework</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ model.framework || 'Not specified' }}
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Created</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ formatDate(model.created_at) }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
                <v-col cols="12" md="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title>Status</v-list-item-title>
                      <v-list-item-subtitle>
                        <v-chip
                          :color="getStatusColor(model.status)"
                          size="small"
                        >
                          {{ model.status || 'draft' }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Version</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ model.version || '1.0.0' }}
                      </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Last Updated</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ formatDate(model.updated_at || model.created_at) }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Model Configuration -->
          <v-card class="mb-4">
            <v-card-title>Configuration</v-card-title>
            <v-divider />
            <v-card-text>
              <v-alert v-if="!model.config" type="info" variant="tonal">
                No configuration details available for this model.
              </v-alert>
              <pre v-else class="config-json">{{ JSON.stringify(model.config, null, 2) }}</pre>
            </v-card-text>
          </v-card>

          <!-- Model Performance -->
          <v-card class="mb-4">
            <v-card-title>Performance Metrics</v-card-title>
            <v-divider />
            <v-card-text>
              <v-alert v-if="!model.metrics" type="info" variant="tonal">
                No performance metrics available for this model.
              </v-alert>
              <div v-else class="metrics-grid">
                <v-card
                  v-for="(metric, key) in model.metrics"
                  :key="key"
                  variant="outlined"
                  class="metric-card"
                >
                  <v-card-text class="text-center">
                    <div class="text-h6 font-weight-bold">
                      {{ metric.value }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis">
                      {{ key }}
                    </div>
                  </v-card-text>
                </v-card>
              </div>
            </v-card-text>
          </v-card>

          <!-- Model History -->
          <v-card>
            <v-card-title>Model History</v-card-title>
            <v-divider />
            <v-card-text>
              <v-timeline>
                <v-timeline-item
                  v-for="(event, index) in modelHistory"
                  :key="index"
                  :dot-color="getTimelineColor(event.type)"
                  size="small"
                >
                  <template #opposite>
                    <div class="text-caption">
                      {{ formatDate(event.timestamp) }}
                    </div>
                  </template>
                  <v-card variant="outlined">
                    <v-card-text>
                      <div class="d-flex align-center">
                        <v-icon
                          :color="getTimelineColor(event.type)"
                          class="mr-2"
                        >
                          {{ getTimelineIcon(event.type) }}
                        </v-icon>
                        <div>
                          <div class="font-weight-medium">
                            {{ event.title }}
                          </div>
                          <div class="text-body-2 text-medium-emphasis">
                            {{ event.description }}
                          </div>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-timeline-item>
              </v-timeline>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <ModelGuide page="details" />
        
        <v-card class="mb-4">
          <v-btn
            v-if="model?.status === 'ready'"
            color="success"
            variant="elevated"
            block
            class="mb-2"
            prepend-icon="mdi-rocket-launch"
            @click="deployModel"
          >
            Deploy Model
          </v-btn>
          <v-btn
            v-if="model?.status === 'draft'"
            color="secondary"
            variant="elevated"
            block
            class="mb-2"
            prepend-icon="mdi-school"
            @click="trainModel"
          >
            Train Model
          </v-btn>
        </v-card>

        <v-card>
          <v-card-title>Model Information</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  ID
                </v-list-item-title>
                <v-list-item-subtitle>{{ model?.id }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Type
                </v-list-item-title>
                <v-list-item-subtitle>{{ model?.type || 'Custom' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Framework
                </v-list-item-title>
                <v-list-item-subtitle>{{ model?.framework || 'Not specified' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'
import { useSupabase } from '~/composables/supabase'

interface Model {
  id: string
  name: string
  type?: string
  status?: string
  version?: string
  created_at: string
  updated_at?: string
  description?: string
  framework?: string
  config?: any
  metrics?: Record<string, any>
}

interface ModelHistoryEvent {
  type: 'created' | 'trained' | 'deployed' | 'updated' | 'error'
  title: string
  description: string
  timestamp: string
}

const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const model = ref<Model | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const modelHistory = ref<ModelHistoryEvent[]>([])

// Helper functions
const getModelIcon = (type?: string) => {
  const icons: Record<string, string> = {
    'Classification': 'mdi-tag-multiple',
    'Regression': 'mdi-chart-line',
    'Neural Network': 'mdi-brain',
    'Transformer': 'mdi-transformer',
    'Custom': 'mdi-cog'
  }
  return icons[type || ''] || 'mdi-brain'
}

const getStatusColor = (status?: string) => {
  const colors: Record<string, string> = {
    'draft': 'grey',
    'training': 'orange',
    'ready': 'green',
    'deployed': 'blue',
    'error': 'red'
  }
  return colors[status || 'draft']
}

const getTimelineColor = (type: string) => {
  const colors: Record<string, string> = {
    'created': 'primary',
    'trained': 'success',
    'deployed': 'info',
    'updated': 'warning',
    'error': 'error'
  }
  return colors[type] || 'grey'
}

const getTimelineIcon = (type: string) => {
  const icons: Record<string, string> = {
    'created': 'mdi-plus',
    'trained': 'mdi-school',
    'deployed': 'mdi-rocket-launch',
    'updated': 'mdi-pencil',
    'error': 'mdi-alert'
  }
  return icons[type] || 'mdi-circle'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Action handlers
const editModel = () => {
  if (model.value) {
    router.push(`/models/${model.value.id}/edit`)
  }
}

const deployModel = () => {
  if (model.value) {
    router.push(`/models/deploy?model=${model.value.id}`)
  }
}

const trainModel = () => {
  if (model.value) {
    router.push(`/models/train?model=${model.value.id}`)
  }
}

const deleteModel = async () => {
  if (model.value && confirm(`Are you sure you want to delete "${model.value.name}"?`)) {
    try {
      const { error: err } = await supabase
        .from('models')
        .delete()
        .eq('id', model.value.id)
      
      if (err) {
        error.value = err.message
      } else {
        router.push('/models')
      }
    } catch (err) {
      error.value = 'Failed to delete model'
    }
  }
}

// Load model details
const loadModel = async () => {
  const modelId = route.params.id as string
  if (!modelId) {
    error.value = 'Model ID is required'
    loading.value = false
    return
  }

  try {
    const { data, error: err } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .single()
    
    if (err) {
      error.value = err.message
    } else {
      model.value = data
      // Generate mock history for demonstration
      generateModelHistory()
    }
  } catch (err) {
    error.value = 'Failed to load model details'
  } finally {
    loading.value = false
  }
}

const generateModelHistory = () => {
  if (!model.value) return

  const history: ModelHistoryEvent[] = [
    {
      type: 'created',
      title: 'Model Created',
      description: `Model "${model.value.name}" was created`,
      timestamp: model.value.created_at
    }
  ]

  if (model.value.status === 'ready') {
    history.push({
      type: 'trained',
      title: 'Training Completed',
      description: 'Model training was completed successfully',
      timestamp: model.value.updated_at || model.value.created_at
    })
  }

  if (model.value.status === 'deployed') {
    history.push({
      type: 'deployed',
      title: 'Model Deployed',
      description: 'Model was deployed to production',
      timestamp: model.value.updated_at || model.value.created_at
    })
  }

  modelHistory.value = history.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

onMounted(() => {
  loadModel()
})
</script>

<style scoped>
.model-details {
  max-width: 100%;
}

.config-json {
  background: rgba(0, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  overflow-x: auto;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.metric-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style> 