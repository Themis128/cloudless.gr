<template>
  <div>
    <LayoutPageStructure
      :title="`Test Model: ${model?.name || 'Loading...'}`"
      subtitle="Test your model with sample inputs"
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
          <!-- Model Info -->
          <v-card class="mb-4 bg-white">
            <v-card-title class="d-flex align-center">
              <v-icon start color="primary">{{ getModelIcon(model.type) }}</v-icon>
              {{ model.name }}
            </v-card-title>
            <v-card-text>
              <div class="d-flex align-center gap-4 mb-2">
                <v-chip :color="getStatusColor(model.status)" size="small">
                  {{ model.status }}
                </v-chip>
                <span class="text-body-2">{{ model.type }}</span>
                <span v-if="model.accuracy" class="text-body-2">
                  Accuracy: {{ (model.accuracy * 100).toFixed(1) }}%
                </span>
              </div>
              <p v-if="model.description" class="text-body-2 text-medium-emphasis">
                {{ model.description }}
              </p>
            </v-card-text>
          </v-card>
          
          <!-- Model Tester -->
          <ModelsModelTester :model-id="modelId" />
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
import { useModelStore } from '~/stores/modelStore'

const route = useRoute()
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
</style> 