<template>
  <div>
    <LayoutPageStructure
      :title="`Model: ${model?.name || 'Loading...'}`"
      subtitle="Model details and management"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <div v-if="modelStore.isLoading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <p class="mt-2 text-body-2">Loading model...</p>
        </div>
        
        <div v-else-if="!model" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-alert-circle</v-icon>
          <h3 class="text-h6 mb-2">Model not found</h3>
          <p class="text-body-2 text-medium-emphasis mb-4">The requested model could not be found.</p>
          <v-btn to="/models" color="primary">Back to Models</v-btn>
        </div>
        
        <div v-else>
          <!-- Model Header -->
          <v-card class="mb-4 bg-white">
            <v-card-title class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-avatar color="primary" size="48" class="mr-3">
                  <v-icon color="white" size="24">{{ getModelIcon(model.type) }}</v-icon>
                </v-avatar>
                <div>
                  <h2 class="text-h5">{{ model.name }}</h2>
                  <p class="text-body-2 text-medium-emphasis">{{ model.type }}</p>
                </div>
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  v-if="model.status === 'ready'"
                  to="`/models/${model.id}/test`"
                  color="primary"
                  prepend-icon="mdi-play-circle"
                >
                  Test Model
                </v-btn>
                <v-btn
                  v-if="model.status === 'ready'"
                  @click="deployModel"
                  color="success"
                  prepend-icon="mdi-rocket-launch"
                >
                  Deploy
                </v-btn>
                <v-btn
                  v-if="model.status === 'draft'"
                  @click="startTraining"
                  color="info"
                  prepend-icon="mdi-school"
                >
                  Start Training
                </v-btn>
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-dots-vertical"
                      variant="text"
                    />
                  </template>
                  <v-list>
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      @click="editModel"
                    >
                      Edit Model
                    </v-list-item>
                    <v-list-item
                      prepend-icon="mdi-delete"
                      @click="deleteModel"
                    >
                      Delete Model
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </v-card-title>
            
            <v-card-text>
              <v-row>
                <v-col cols="12" md="8">
                  <p v-if="model.description" class="text-body-1 mb-4">
                    {{ model.description }}
                  </p>
                  
                  <div class="d-flex flex-wrap gap-4 mb-4">
                    <v-chip :color="getStatusColor(model.status)" size="large">
                      {{ model.status }}
                    </v-chip>
                    <v-chip v-if="model.accuracy" color="success" size="large">
                      {{ (model.accuracy * 100).toFixed(1) }}% Accuracy
                    </v-chip>
                    <v-chip color="info" size="large">
                      Created {{ formatDate(model.createdAt) }}
                    </v-chip>
                  </div>
                </v-col>
                
                <v-col cols="12" md="4">
                  <v-card variant="outlined">
                    <v-card-title>Quick Stats</v-card-title>
                    <v-card-text>
                      <div class="d-flex justify-space-between mb-2">
                        <span>Status:</span>
                        <v-chip :color="getStatusColor(model.status)" size="small">
                          {{ model.status }}
                        </v-chip>
                      </div>
                      <div class="d-flex justify-space-between mb-2">
                        <span>Type:</span>
                        <span>{{ model.type }}</span>
                      </div>
                      <div v-if="model.accuracy" class="d-flex justify-space-between mb-2">
                        <span>Accuracy:</span>
                        <span>{{ (model.accuracy * 100).toFixed(1) }}%</span>
                      </div>
                      <div class="d-flex justify-space-between">
                        <span>Last Updated:</span>
                        <span>{{ formatDate(model.updatedAt) }}</span>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
          
          <!-- Model Configuration -->
          <v-card class="mb-4 bg-white">
            <v-card-title>Configuration</v-card-title>
            <v-card-text>
              <v-textarea
                :model-value="model.config"
                label="Model Configuration (JSON)"
                variant="outlined"
                rows="8"
                readonly
              />
            </v-card-text>
          </v-card>
          
          <!-- Training History -->
          <v-card v-if="model.trainings && model.trainings.length > 0" class="mb-4 bg-white">
            <v-card-title>Training History</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item
                  v-for="training in model.trainings"
                  :key="training.id"
                  class="mb-2"
                  rounded="lg"
                  variant="outlined"
                >
                  <template #prepend>
                    <v-avatar color="info" size="32">
                      <v-icon color="white" size="16">mdi-school</v-icon>
                    </v-avatar>
                  </template>
                  
                  <v-list-item-title class="text-body-1">
                    Training Session #{{ training.id }}
                  </v-list-item-title>
                  
                  <v-list-item-subtitle class="text-caption">
                    {{ formatDate(training.createdAt) }} - {{ training.status }}
                  </v-list-item-subtitle>
                  
                  <template #append>
                    <v-chip
                      :color="getTrainingStatusColor(training.status)"
                      size="small"
                      variant="tonal"
                    >
                      {{ training.status }}
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <ModelGuide />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutPageStructure from '~/components/layout/LayoutPageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'
import { useModelStore } from '~/stores/modelStore'

const route = useRoute()
const router = useRouter()
const modelStore = useModelStore()

const modelId = computed(() => parseInt(route.params.id as string))
const model = computed(() => modelStore.modelById(modelId.value))

const getModelIcon = (type: string) => {
  switch (type) {
    case 'text-classification': return 'mdi-text'
    case 'image-classification': return 'mdi-image'
    case 'object-detection': return 'mdi-target'
    case 'sentiment-analysis': return 'mdi-emoticon'
    case 'translation': return 'mdi-translate'
    case 'summarization': return 'mdi-text-box'
    case 'regression': return 'mdi-chart-line'
    case 'clustering': return 'mdi-chart-bubble'
    default: return 'mdi-brain'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'draft': return 'warning'
    case 'training': return 'info'
    case 'deployed': return 'primary'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const getTrainingStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'info'
    case 'pending': return 'warning'
    case 'failed': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

const editModel = () => {
  router.push(`/models/${modelId.value}/edit`)
}

const deleteModel = async () => {
  if (confirm(`Are you sure you want to delete "${model.value?.name}"?`)) {
    const success = await modelStore.deleteModel(modelId.value)
    if (success) {
      router.push('/models')
    }
  }
}

const deployModel = async () => {
  const success = await modelStore.deployModel(modelId.value)
  if (success) {
    // Show success message or navigate
  }
}

const startTraining = async () => {
  await modelStore.startTraining(modelId.value)
}

onMounted(() => {
  // Fetch models if not already loaded
  if (modelStore.allModels.length === 0) {
    modelStore.fetchAll()
  }
})
</script>

<style scoped>
.gap-4 {
  gap: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}
</style> 