<template>
  <div class="create-project-page">
    <!-- Page Header -->
    <div class="page-header">
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        class="mb-4"
        @click="navigateTo('/projects')"
      >
        Back to Projects
      </v-btn>
      
      <div class="header-content">
        <v-avatar size="48" color="success" class="me-4">
          <v-icon icon="mdi-plus-circle" size="24" color="white" />
        </v-avatar>
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">Create New Project</h1>
          <p class="text-body-1 text-medium-emphasis">
            Set up a new ML pipeline project with your preferred configuration
          </p>
        </div>
      </div>
    </div>

    <!-- Create Form -->
    <v-card class="create-form-card" elevation="2">
      <v-card-text class="pa-8">
        <ProjectCreateForm
          :loading="loading"
          @create="handleCreateProject"
          @cancel="navigateTo('/projects')"
        />
      </v-card-text>
    </v-card>

    <!-- Project Templates -->
    <v-card class="mt-6" elevation="1">
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-file-document-multiple" class="me-2" />
        Quick Start Templates
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col
            v-for="template in projectTemplates"
            :key="template.id"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card
              class="template-card"
              variant="outlined"
              hover
              @click="selectTemplate(template)"
            >
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-3">
                  <v-avatar :color="template.color" size="40" class="me-3">
                    <v-icon :icon="template.icon" color="white" />
                  </v-avatar>
                  <div>
                    <h4 class="text-h6 font-weight-medium">{{ template.name }}</h4>
                    <p class="text-caption text-medium-emphasis mb-0">
                      {{ template.category }}
                    </p>
                  </div>
                </div>
                <p class="text-body-2 mb-3">{{ template.description }}</p>
                <div class="d-flex flex-wrap gap-1">
                  <v-chip
                    v-for="tech in template.technologies"
                    :key="tech"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                  >
                    {{ tech }}
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Meta
definePageMeta({
  layout: 'default',
  title: 'Create Project',
  requiresAuth: true
})

// Composables
const { createProject } = useCreateProject()

// State
const loading = ref(false)

// Project Templates
const projectTemplates = ref([
  {
    id: 'image-classification',
    name: 'Image Classification',
    category: 'Computer Vision',
    description: 'Build image classification models with pre-trained networks',
    icon: 'mdi-image-outline',
    color: 'blue',
    technologies: ['PyTorch', 'ResNet', 'Transfer Learning'],
    config: {
      type: 'cv',
      framework: 'pytorch',
      nodes: [
        { type: 'data-loader', config: { format: 'image' } },
        { type: 'preprocessing', config: { resize: true, normalize: true } },
        { type: 'model', config: { architecture: 'resnet50' } },
        { type: 'training', config: { epochs: 50, batch_size: 32 } }
      ]
    }
  },
  {
    id: 'text-classification',
    name: 'Text Classification',
    category: 'Natural Language Processing',
    description: 'Classify text documents using transformer models',
    icon: 'mdi-text-box-outline',
    color: 'green',
    technologies: ['Transformers', 'BERT', 'Hugging Face'],
    config: {
      type: 'nlp',
      framework: 'transformers',
      nodes: [
        { type: 'data-loader', config: { format: 'text' } },
        { type: 'tokenizer', config: { model: 'bert-base-uncased' } },
        { type: 'model', config: { architecture: 'bert' } },
        { type: 'training', config: { epochs: 10, learning_rate: 2e-5 } }
      ]
    }
  },
  {
    id: 'regression',
    name: 'Regression Analysis',
    category: 'Machine Learning',
    description: 'Predict continuous values with regression models',
    icon: 'mdi-chart-line',
    color: 'orange',
    technologies: ['Scikit-learn', 'XGBoost', 'Feature Engineering'],
    config: {
      type: 'regression',
      framework: 'sklearn',
      nodes: [
        { type: 'data-loader', config: { format: 'tabular' } },
        { type: 'feature-engineering', config: { scaling: true } },
        { type: 'model', config: { algorithm: 'xgboost' } },
        { type: 'evaluation', config: { metrics: ['mse', 'r2'] } }
      ]
    }
  },
  {
    id: 'recommendation',
    name: 'Recommendation System',
    category: 'Machine Learning',
    description: 'Build collaborative filtering recommendation systems',
    icon: 'mdi-star-outline',
    color: 'purple',
    technologies: ['Collaborative Filtering', 'Matrix Factorization', 'PyTorch'],
    config: {
      type: 'recommendation',
      framework: 'pytorch',
      nodes: [
        { type: 'data-loader', config: { format: 'interactions' } },
        { type: 'preprocessing', config: { implicit: true } },
        { type: 'model', config: { algorithm: 'matrix_factorization' } },
        { type: 'evaluation', config: { metrics: ['precision_at_k', 'recall_at_k'] } }
      ]
    }
  },
  {
    id: 'time-series',
    name: 'Time Series Forecasting',
    category: 'Machine Learning',
    description: 'Forecast future values using time series models',
    icon: 'mdi-chart-timeline-variant',
    color: 'indigo',
    technologies: ['LSTM', 'Prophet', 'Time Series Analysis'],
    config: {
      type: 'time-series',
      framework: 'pytorch',
      nodes: [
        { type: 'data-loader', config: { format: 'time-series' } },
        { type: 'preprocessing', config: { seasonality: true } },
        { type: 'model', config: { architecture: 'lstm' } },
        { type: 'forecasting', config: { horizon: 30 } }
      ]
    }
  },
  {
    id: 'custom',
    name: 'Custom Pipeline',
    category: 'Custom',
    description: 'Start with a blank canvas and build your own pipeline',
    icon: 'mdi-puzzle-outline',
    color: 'grey',
    technologies: ['Flexible', 'Custom', 'Any Framework'],
    config: {
      type: 'custom',
      framework: 'custom',
      nodes: []
    }
  }
])

// Methods
const handleCreateProject = async (projectData: any) => {
  try {
    loading.value = true
    const project = await createProject(projectData)
    
    // Navigate to the new project
    await navigateTo(`/projects/${project.id}`)
  } catch (error) {
    console.error('Failed to create project:', error)
    // Handle error (show notification, etc.)
  } finally {
    loading.value = false
  }
}

const selectTemplate = (template: any) => {
  // You can emit this to the form or handle template selection
  console.log('Selected template:', template)
  // For now, we'll just log it. In a real app, you'd pass this to the form component
}
</script>

<style scoped>
.create-project-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  align-items: center;
}

.create-form-card {
  border-radius: 16px;
}

.template-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12px;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

@media (max-width: 768px) {
  .create-project-page {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }
}
</style>
