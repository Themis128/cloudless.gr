<template>
  <div>
    <PageStructure
      :title="model?.name || 'Model Details'"
      :subtitle="model?.description || 'View and manage model details'"
      back-button-to="/llm/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">
            Loading model details...
          </p>
        </div>

        <!-- Model Not Found -->
        <div v-else-if="!model" class="text-center py-8">
          <v-icon size="64" color="error" class="mb-4">
            mdi-alert-circle
          </v-icon>
          <h2 class="text-h5 mb-2">
            Model Not Found
          </h2>
          <p class="text-body-1 mb-4">
            The model you're looking for doesn't exist or has been removed.
          </p>
          <v-btn color="primary" to="/llm/models">
            Back to Models
          </v-btn>
        </div>

        <!-- Model Details -->
        <div v-else>
          <!-- Model Overview -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-brain
              </v-icon>
              Model Overview
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Name:</strong> {{ model.name }}
                  </div>
                  <div class="mb-4">
                    <strong>Description:</strong> {{ model.description || 'No description available' }}
                  </div>
                  <div class="mb-4">
                    <strong>Type:</strong>
                    <v-chip
                      color="info"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ model.type }}
                    </v-chip>
                  </div>
                  <div class="mb-4">
                    <strong>Status:</strong>
                    <v-chip
                      :color="getStatusColor(model.status)"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ model.status }}
                    </v-chip>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ model.base_model }}
                  </div>
                  <div class="mb-4">
                    <strong>Accuracy:</strong> {{ model.accuracy }}%
                  </div>
                  <div class="mb-4">
                    <strong>Created:</strong> {{ formatDate(model.created_at) }}
                  </div>
                  <div class="mb-4">
                    <strong>Model ID:</strong> {{ model.id }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Performance Metrics -->
          <v-row class="mb-4">
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="success" class="mb-2">
                    mdi-chart-line
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ model.accuracy }}%
                  </div>
                  <div class="text-body-2">
                    Accuracy
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="info" class="mb-2">
                    mdi-clock-outline
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ model.parameters?.epochs || 0 }}
                  </div>
                  <div class="text-body-2">
                    Epochs
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="warning" class="mb-2">
                    mdi-database
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ model.parameters?.batch_size || 0 }}
                  </div>
                  <div class="text-body-2">
                    Batch Size
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="primary" class="mb-2">
                    mdi-file-document
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ model.size || '2.1GB' }}
                  </div>
                  <div class="text-body-2">
                    Model Size
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Quick Actions -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-lightning-bolt
              </v-icon>
              Quick Actions
            </v-card-title>
            <v-card-text>
              <div class="d-flex gap-3 flex-wrap">
                <v-btn
                  color="success"
                  prepend-icon="mdi-play-circle"
                  variant="elevated"
                  size="large"
                  @click="testModel"
                >
                  Test Model
                </v-btn>
                <v-btn
                  color="warning"
                  prepend-icon="mdi-pencil"
                  variant="outlined"
                  size="large"
                  @click="editModel"
                >
                  Edit Model
                </v-btn>
                <v-btn
                  color="info"
                  prepend-icon="mdi-rocket-launch"
                  variant="outlined"
                  size="large"
                  @click="deployModel"
                >
                  Deploy Model
                </v-btn>
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-download"
                  variant="outlined"
                  size="large"
                  @click="downloadModel"
                >
                  Download
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <!-- Training Configuration -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-cog
              </v-icon>
              Training Configuration
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ model.base_model }}
                  </div>
                  <div class="mb-4">
                    <strong>Training Type:</strong> Fine-tuning
                  </div>
                  <div class="mb-4">
                    <strong>Epochs:</strong> {{ model.parameters?.epochs || 'N/A' }}
                  </div>
                  <div class="mb-4">
                    <strong>Batch Size:</strong> {{ model.parameters?.batch_size || 'N/A' }}
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Learning Rate:</strong> {{ model.parameters?.learning_rate || 'N/A' }}
                  </div>
                  <div class="mb-4">
                    <strong>Optimizer:</strong> AdamW
                  </div>
                  <div class="mb-4">
                    <strong>Loss Function:</strong> Cross-Entropy
                  </div>
                  <div class="mb-4">
                    <strong>Validation Split:</strong> 20%
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Performance History -->
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-chart-line
              </v-icon>
              Performance History
            </v-card-title>
            <v-card-text>
              <v-tabs v-model="activeTab" color="primary">
                <v-tab value="accuracy">
                  <v-icon start>
                    mdi-chart-line
                  </v-icon>
                  Accuracy
                </v-tab>
                <v-tab value="loss">
                  <v-icon start>
                    mdi-trending-down
                  </v-icon>
                  Loss
                </v-tab>
                <v-tab value="usage">
                  <v-icon start>
                    mdi-chart-bar
                  </v-icon>
                  Usage
                </v-tab>
              </v-tabs>

              <v-window v-model="activeTab" class="mt-4">
                <v-window-item value="accuracy">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p>Accuracy chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Training accuracy over time
                    </p>
                  </div>
                </v-window-item>

                <v-window-item value="loss">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-trending-down
                    </v-icon>
                    <p>Loss chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Training loss over time
                    </p>
                  </div>
                </v-window-item>

                <v-window-item value="usage">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-bar
                    </v-icon>
                    <p>Usage statistics will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Model usage over time
                    </p>
                  </div>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <LLMGuide page="models" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const model = ref<any>(null)
const activeTab = ref('accuracy')

// Mock model data - in a real app, this would come from an API
const mockModels = [
  {
    id: '1',
    name: 'GPT-4 Fine-tuned',
    description: 'Customer support model fine-tuned on support conversations',
    type: 'text-generation',
    status: 'ready',
    accuracy: 94,
    created_at: '2024-01-15',
    base_model: 'gpt-4',
    size: '2.1GB',
    parameters: { 
      epochs: 10, 
      batch_size: 32, 
      learning_rate: 0.0001 
    }
  },
  {
    id: '2',
    name: 'BERT Classification',
    description: 'Text classification model for sentiment analysis',
    type: 'text-classification',
    status: 'training',
    accuracy: 87,
    created_at: '2024-01-20',
    base_model: 'bert-base-uncased',
    size: '1.2GB',
    parameters: { 
      epochs: 5, 
      batch_size: 16, 
      learning_rate: 0.0002 
    }
  },
  {
    id: '3',
    name: 'T5 Summarization',
    description: 'Text summarization model for document processing',
    type: 'text-generation',
    status: 'ready',
    accuracy: 91,
    created_at: '2024-01-18',
    base_model: 't5-base',
    size: '850MB',
    parameters: { 
      epochs: 8, 
      batch_size: 8, 
      learning_rate: 0.0003 
    }
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'training': return 'warning'
    case 'deployed': return 'info'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const testModel = () => {
  router.push(`/llm/models/${model.value?.id}/test`)
}

const editModel = () => {
  router.push(`/llm/models/${model.value?.id}/edit`)
}

const deployModel = () => {
  router.push(`/llm/deployments/create?model=${model.value?.id}`)
}

const downloadModel = () => {
  // In a real app, this would trigger a download
      // Downloading model
}

onMounted(async () => {
  const modelId = route.params.id as string
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Find model in mock data
  model.value = mockModels.find(m => m.id === modelId) || null
  
  loading.value = false
})
</script>

<style scoped>
.metric-card {
  transition: transform 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
}

.gap-3 {
  gap: 1rem;
}

/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-tab) {
  color: black !important;
}

:deep(.v-tab--selected) {
  color: black !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-btn) {
  color: black !important;
}
</style> 