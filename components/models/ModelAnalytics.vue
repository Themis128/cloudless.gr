<template>
  <v-card class="bg-white">
    <v-card-title class="d-flex align-center">
      <v-icon start color="primary">
        mdi-chart-line
      </v-icon>
      Model Analytics
    </v-card-title>
    
    <v-card-text>
      <!-- Summary Stats -->
      <v-row class="mb-6">
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center pa-4">
            <v-icon size="32" color="primary" class="mb-2">mdi-brain</v-icon>
            <div class="text-h4 font-weight-bold">{{ modelStore.allModels.length }}</div>
            <div class="text-body-2 text-medium-emphasis">Total Models</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center pa-4">
            <v-icon size="32" color="success" class="mb-2">mdi-check-circle</v-icon>
            <div class="text-h4 font-weight-bold">{{ modelStore.readyModels.length }}</div>
            <div class="text-body-2 text-medium-emphasis">Ready Models</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center pa-4">
            <v-icon size="32" color="info" class="mb-2">mdi-school</v-icon>
            <div class="text-h4 font-weight-bold">{{ modelStore.trainingModels.length }}</div>
            <div class="text-body-2 text-medium-emphasis">Training</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center pa-4">
            <v-icon size="32" color="primary" class="mb-2">mdi-rocket-launch</v-icon>
            <div class="text-h4 font-weight-bold">{{ modelStore.deployedModels.length }}</div>
            <div class="text-body-2 text-medium-emphasis">Deployed</div>
          </v-card>
        </v-col>
      </v-row>
      
      <!-- Model Types Distribution -->
      <v-card variant="outlined" class="mb-6">
        <v-card-title>Model Types Distribution</v-card-title>
        <v-card-text>
          <div class="d-flex flex-wrap gap-4">
            <v-chip
              v-for="type in modelTypes"
              :key="type.value"
              :color="getTypeColor(type.value)"
              variant="tonal"
              size="large"
            >
              <v-icon start>{{ getModelIcon(type.value) }}</v-icon>
              {{ type.title }} ({{ getModelCountByType(type.value) }})
            </v-chip>
          </div>
        </v-card-text>
      </v-card>
      
      <!-- Recent Activity -->
      <v-card variant="outlined">
        <v-card-title>Recent Activity</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="model in recentModels"
              :key="model.id"
              class="mb-2"
              rounded="lg"
              variant="outlined"
            >
              <template #prepend>
                <v-avatar color="primary" size="32">
                  <v-icon color="white" size="16">{{ getModelIcon(model.type) }}</v-icon>
                </v-avatar>
              </template>
              
              <v-list-item-title class="text-body-1">
                {{ model.name }}
              </v-list-item-title>
              
              <v-list-item-subtitle class="text-caption">
                {{ formatDate(model.updatedAt) }} - {{ model.status }}
              </v-list-item-subtitle>
              
              <template #append>
                <v-chip
                  :color="getStatusColor(model.status)"
                  size="small"
                  variant="tonal"
                >
                  {{ model.status }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          
          <div v-if="recentModels.length === 0" class="text-center py-4">
            <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-chart-line</v-icon>
            <p class="text-body-2 text-medium-emphasis">No recent activity</p>
          </div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useModelStore } from '~/stores/modelStore'

const modelStore = useModelStore()

const modelTypes = [
  { title: 'Text Classification', value: 'text-classification' },
  { title: 'Image Classification', value: 'image-classification' },
  { title: 'Object Detection', value: 'object-detection' },
  { title: 'Sentiment Analysis', value: 'sentiment-analysis' },
  { title: 'Translation', value: 'translation' },
  { title: 'Summarization', value: 'summarization' },
  { title: 'Regression', value: 'regression' },
  { title: 'Clustering', value: 'clustering' }
]

const recentModels = computed(() => {
  return modelStore.allModels
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
})

const getModelCountByType = (type: string) => {
  return modelStore.modelsByType(type).length
}

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

const getTypeColor = (type: string) => {
  switch (type) {
    case 'text-classification': return 'primary'
    case 'image-classification': return 'success'
    case 'object-detection': return 'warning'
    case 'sentiment-analysis': return 'info'
    case 'translation': return 'secondary'
    case 'summarization': return 'purple'
    case 'regression': return 'orange'
    case 'clustering': return 'teal'
    default: return 'grey'
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

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}
</script>

<style scoped>
.gap-4 {
  gap: 1rem;
}
</style> 