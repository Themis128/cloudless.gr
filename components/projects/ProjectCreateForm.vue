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
            v-model="form_data.name"
            label="Project Name"
            placeholder="Enter project name"
            variant="outlined"
            :rules="name_rules"
            required
            prepend-inner-icon="mdi-folder-outline"
          />
        </v-col>

        <v-col cols="12" md="6">
          <v-select
            v-model="form_data.type"
            :items="project_types"
            label="Project Type"
            variant="outlined"
            :rules="type_rules"
            required
            prepend-inner-icon="mdi-tag-outline"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :prepend-icon="item.raw.icon">
                <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
        </v-col>
      </v-row>

      <v-textarea
        v-model="form_data.description"
        label="Description (Optional)"
        placeholder="Describe your project goals and approach"
        variant="outlined"
        rows="3"
        counter="500"
        :rules="description_rules"
        prepend-inner-icon="mdi-text-box-outline"
      />
    </div>

    <!-- Framework & Environment -->
    <div class="form-section">
      <h3 class="section-title">
        <v-icon icon="mdi-cog-outline" class="me-2" />
        Framework & Configuration
      </h3>

      <v-row>
        <v-col cols="12" md="6">
          <v-select
            v-model="form_data.framework"
            :items="framework_options"
            label="ML Framework"
            variant="outlined"
            prepend-inner-icon="mdi-code-tags"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :prepend-icon="item.raw.icon">
                <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.subtitle }}</v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>
        </v-col>

        <v-col cols="12" md="6">
          <v-select
            v-model="form_data.environment"
            :items="environment_options"
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
              <v-switch v-model="form_data.enable_versioning" label="Enable Model Versioning" inset />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch v-model="form_data.enable_monitoring" label="Enable Monitoring" inset />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch v-model="form_data.enable_auto_scaling" label="Enable Auto-scaling" inset />
            </v-col>
            <v-col cols="12" md="6">
              <v-switch v-model="form_data.enable_experiment_tracking" label="Enable Experiment Tracking" inset />
            </v-col>
          </v-row>

          <v-text-field
            v-model="form_data.tags"
            label="Tags (comma-separated)"
            variant="outlined"
            prepend-inner-icon="mdi-tag-multiple"
            class="mt-4"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Actions -->
    <div class="form-actions">
      <v-btn variant="text" size="large" :disabled="loading" @click="$emit('cancel')">
        Cancel
      </v-btn>
      <v-btn
        color="primary"
        size="large"
        type="submit"
        :loading="loading"
        :disabled="!is_form_valid"
        prepend-icon="mdi-plus-circle"
      >
        Create Project
      </v-btn>
    </div>
  </v-form>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { CreateProjectData, ProjectTemplate } from '~/types/project'

const props = defineProps<{
  loading?: boolean
  initialTemplate?: ProjectTemplate | null
}>()

const emit = defineEmits<{
  (e: 'create', data: CreateProjectData): void
  (e: 'cancel'): void
}>()

const form = ref()

const form_data = ref({
  name: '',
  type: '',
  description: '',
  framework: 'pytorch',
  environment: 'cloud',
  enable_versioning: true,
  enable_monitoring: true,
  enable_auto_scaling: false,
  enable_experiment_tracking: true,
  tags: ''
})

// Apply selected template
watch(
  () => props.initialTemplate,
  (template) => {
    if (!template) return
    form_data.value.name = template.name || ''
    form_data.value.type = template.config?.type || ''
    form_data.value.description = template.description || ''
    form_data.value.framework = template.config?.framework || 'pytorch'
    form_data.value.tags = template.technologies?.join(', ') || ''
  },
  { immediate: true }
)

// Validation rules
const name_rules = [
  (v: string) => !!v || 'Name is required',
  (v: string) => v.length <= 100 || 'Max 100 characters',
  (v: string) => /^[a-zA-Z0-9\s\-_]+$/.test(v) || 'Only letters, numbers, space, -, _'
]
const type_rules = [(v: string) => !!v || 'Project type is required']
const description_rules = [(v: string) => !v || v.length <= 500 || 'Max 500 characters']

// Select options
const project_types = [
  { title: 'Image Classification', value: 'cv', subtitle: 'Computer Vision', icon: 'mdi-image-outline' },
  { title: 'Text Classification', value: 'nlp', subtitle: 'NLP', icon: 'mdi-text-box-outline' },
  { title: 'Regression', value: 'regression', subtitle: 'Continuous values', icon: 'mdi-chart-line' },
  { title: 'Classification', value: 'classification', subtitle: 'Categories', icon: 'mdi-chart-pie' },
  { title: 'Clustering', value: 'clustering', subtitle: 'Group data', icon: 'mdi-scatter-plot' },
  { title: 'Recommendation', value: 'recommendation', subtitle: 'Recommender System', icon: 'mdi-star-outline' },
  { title: 'Time Series', value: 'time-series', subtitle: 'Forecasting', icon: 'mdi-chart-timeline-variant' },
  { title: 'Custom', value: 'custom', subtitle: 'Custom pipeline', icon: 'mdi-puzzle-outline' }
]

const framework_options = [
  { title: 'PyTorch', value: 'pytorch', subtitle: 'Deep learning', icon: 'mdi-fire' },
  { title: 'TensorFlow', value: 'tensorflow', subtitle: 'Google ML', icon: 'mdi-robot' },
  { title: 'Scikit-learn', value: 'sklearn', subtitle: 'Traditional ML', icon: 'mdi-chart-box' },
  { title: 'Hugging Face', value: 'transformers', subtitle: 'NLP Transformers', icon: 'mdi-face-outline' },
  { title: 'XGBoost', value: 'xgboost', subtitle: 'Gradient boosting', icon: 'mdi-chart-tree' }
]

const environment_options = [
  { title: 'Cloud (Recommended)', value: 'cloud' },
  { title: 'Local', value: 'local' },
  { title: 'On-Premises', value: 'on-premise' },
  { title: 'Hybrid', value: 'hybrid' }
]

const is_form_valid = computed(() => !!form_data.value.name && !!form_data.value.type)

const handleSubmit = async () => {
  const { valid } = await form.value?.validate()
  if (!valid) return

  const payload: CreateProjectData = {
    name: form_data.value.name,
    description: form_data.value.description,
    type: form_data.value.type,
    framework: form_data.value.framework,
    environment: form_data.value.environment,
    enable_versioning: form_data.value.enable_versioning,
    enable_monitoring: form_data.value.enable_monitoring,
    enable_auto_scaling: form_data.value.enable_auto_scaling,
    enable_experiment_tracking: form_data.value.enable_experiment_tracking,
    tags: form_data.value.tags
  }

  emit('create', payload)
}
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
  }
  .form-actions .v-btn {
    width: 100%;
  }
}
</style>
