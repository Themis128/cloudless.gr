<template>
  <v-form ref="form" @submit.prevent="handleSubmit">
    <!-- Basic Information -->
    <div class="form-section">
      <h3 class="section-title">
        <v-icon icon="mdi-information-outline" class="me-2" />
        Basic Information
      </h3>
      
      <v-row>
        <v-col cols="12" md="6">
          <v-text-field
            v-model="formData.name"
            label="Project Name"
            placeholder="Enter project name"
            variant="outlined"
            :rules="nameRules"
            required
            prepend-inner-icon="mdi-folder-outline"
          />
        </v-col>
        
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.type"
            :items="projectTypes"
            label="Project Type"
            variant="outlined"
            :rules="typeRules"
            required
            prepend-inner-icon="mdi-tag-outline"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :prepend-icon="item.raw.icon">
                <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
        </v-col>
      </v-row>
      
      <v-textarea
        v-model="formData.description"
        label="Description (Optional)"
        placeholder="Describe your project goals and approach"
        variant="outlined"
        rows="3"
        counter="500"
        :rules="descriptionRules"
        prepend-inner-icon="mdi-text-box-outline"
      />
    </div>

    <!-- Framework Selection -->
    <div class="form-section">
      <h3 class="section-title">
        <v-icon icon="mdi-cog-outline" class="me-2" />
        Framework & Configuration
      </h3>
      
      <v-row>
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.framework"
            :items="frameworkOptions"
            label="ML Framework"
            variant="outlined"
            prepend-inner-icon="mdi-code-tags"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :prepend-icon="item.raw.icon">
                <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
        </v-col>
        
        <v-col cols="12" md="6">
          <v-select
            v-model="formData.environment"
            :items="environmentOptions"
            label="Runtime Environment"
            variant="outlined"
            prepend-inner-icon="mdi-server"
          />
        </v-col>
      </v-row>
    </div>

    <!-- Advanced Settings -->
    <v-expansion-panels variant="accordion" class="form-section">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <div class="d-flex align-center">
            <v-icon icon="mdi-tune" class="me-2" />
            Advanced Settings
          </div>
        </v-expansion-panel-title>
        
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-switch
                v-model="formData.enableVersioning"
                label="Enable Model Versioning"
                color="primary"
                inset
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-switch
                v-model="formData.enableMonitoring"
                label="Enable Performance Monitoring"
                color="primary"
                inset
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-switch
                v-model="formData.enableAutoScaling"
                label="Enable Auto-scaling"
                color="primary"
                inset
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-switch
                v-model="formData.enableExperimentTracking"
                label="Enable Experiment Tracking"
                color="primary"
                inset
              />
            </v-col>
          </v-row>
          
          <v-text-field
            v-model="formData.tags"
            label="Tags (comma-separated)"
            placeholder="machine-learning, computer-vision, pytorch"
            variant="outlined"
            prepend-inner-icon="mdi-tag-multiple"
            class="mt-4"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Actions -->
    <div class="form-actions">
      <v-btn
        variant="text"
        size="large"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        Cancel
      </v-btn>
      
      <v-btn
        color="primary"
        size="large"
        type="submit"
        :loading="loading"
        :disabled="!isFormValid"
        prepend-icon="mdi-plus-circle"
      >
        Create Project
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CreateProjectData } from '~/types/project'

// Props
interface Props {
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

// Emits
const emit = defineEmits<{
  create: [data: CreateProjectData]
  cancel: []
}>()

// Form ref
const form = ref()

// Form data
const formData = ref({
  name: '',
  type: '',
  description: '',
  framework: 'pytorch',
  environment: 'cloud',
  enableVersioning: true,
  enableMonitoring: true,
  enableAutoScaling: false,
  enableExperimentTracking: true,
  tags: ''
})

// Form validation rules
const nameRules = [
  (v: string) => !!v || 'Project name is required',
  (v: string) => v.length <= 100 || 'Name must be less than 100 characters',
  (v: string) => /^[a-zA-Z0-9\s\-_]+$/.test(v) || 'Name can only contain letters, numbers, spaces, hyphens, and underscores'
]

const typeRules = [
  (v: string) => !!v || 'Project type is required'
]

const descriptionRules = [
  (v: string) => !v || v.length <= 500 || 'Description must be less than 500 characters'
]

// Project type options
const projectTypes = ref([
  {
    title: 'Image Classification',
    value: 'cv',
    subtitle: 'Computer Vision',
    icon: 'mdi-image-outline'
  },
  {
    title: 'Text Classification',
    value: 'nlp',
    subtitle: 'Natural Language Processing',
    icon: 'mdi-text-box-outline'
  },
  {
    title: 'Regression Analysis',
    value: 'regression',
    subtitle: 'Predict continuous values',
    icon: 'mdi-chart-line'
  },
  {
    title: 'Classification',
    value: 'classification',
    subtitle: 'Predict categories',
    icon: 'mdi-chart-pie'
  },
  {
    title: 'Clustering',
    value: 'clustering',
    subtitle: 'Group similar data',
    icon: 'mdi-scatter-plot'
  },
  {
    title: 'Recommendation System',
    value: 'recommendation',
    subtitle: 'Personalized recommendations',
    icon: 'mdi-star-outline'
  },
  {
    title: 'Time Series Forecasting',
    value: 'time-series',
    subtitle: 'Predict future values',
    icon: 'mdi-chart-timeline-variant'
  },
  {
    title: 'Custom Pipeline',
    value: 'custom',
    subtitle: 'Build your own',
    icon: 'mdi-puzzle-outline'
  }
])

// Framework options
const frameworkOptions = ref([
  {
    title: 'PyTorch',
    value: 'pytorch',
    subtitle: 'Deep learning framework',
    icon: 'mdi-fire'
  },
  {
    title: 'TensorFlow',
    value: 'tensorflow',
    subtitle: 'Google\'s ML platform',
    icon: 'mdi-robot'
  },
  {
    title: 'Scikit-learn',
    value: 'sklearn',
    subtitle: 'Traditional ML',
    icon: 'mdi-chart-box'
  },
  {
    title: 'Hugging Face',
    value: 'transformers',
    subtitle: 'NLP transformers',
    icon: 'mdi-face-outline'
  },
  {
    title: 'XGBoost',
    value: 'xgboost',
    subtitle: 'Gradient boosting',
    icon: 'mdi-chart-tree'
  }
])

// Environment options
const environmentOptions = ref([
  { title: 'Cloud (Recommended)', value: 'cloud' },
  { title: 'Local Development', value: 'local' },
  { title: 'On-Premises', value: 'on-premise' },
  { title: 'Hybrid', value: 'hybrid' }
])

// Computed
const isFormValid = computed(() => {
  return formData.value.name && formData.value.type
})

// Methods
const handleSubmit = async () => {
  const { valid } = await form.value.validate()
  
  if (valid) {
    const createData: CreateProjectData = {
      name: formData.value.name,
      description: formData.value.description || undefined,
      type: formData.value.type as any,
      // Add other config data as needed
    }
    
    emit('create', createData)
  }
}

// Reset form when loading changes
watch(() => props.loading, (newLoading) => {
  if (!newLoading) {
    // Reset form if needed
  }
})
</script>

<style scoped>
.form-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface));
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(var(--v-theme-outline), 0.12);
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
    gap: 12px;
  }
  
  .form-actions .v-btn {
    width: 100%;
  }
}
</style>
