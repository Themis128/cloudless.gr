<template>
  <div>
    <PageStructure
      :title="`Edit ${model?.name || 'Model'}`"
      subtitle="Update your model configuration and settings"
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

        <!-- Edit Form -->
        <div v-else-if="model" class="edit-form">
          <v-form ref="form" @submit.prevent="saveModel">
            <!-- Basic Information -->
            <v-card class="mb-4">
              <v-card-title class="d-flex align-center justify-space-between">
                <span>Basic Information</span>
                <div class="d-flex gap-2">
                  <v-btn
                    color="secondary"
                    variant="outlined"
                    size="small"
                    @click="cancelEdit"
                  >
                    Cancel
                  </v-btn>
                  <v-btn
                    type="submit"
                    color="primary"
                    variant="elevated"
                    size="small"
                    :loading="saving"
                    :disabled="saving"
                  >
                    Save Changes
                  </v-btn>
                </div>
              </v-card-title>
              <v-divider />
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.name"
                      label="Model Name"
                      required
                      :rules="[v => !!v || 'Name is required']"
                      variant="outlined"
                      class="mb-3"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="formData.type"
                      :items="modelTypes"
                      label="Model Type"
                      required
                      :rules="[v => !!v || 'Type is required']"
                      variant="outlined"
                      class="mb-3"
                    />
                  </v-col>
                </v-row>
                <v-textarea
                  v-model="formData.description"
                  label="Description"
                  variant="outlined"
                  rows="3"
                  class="mb-3"
                  placeholder="Describe your model's purpose and capabilities..."
                />
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.version"
                      label="Version"
                      variant="outlined"
                      class="mb-3"
                      placeholder="1.0.0"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.framework"
                      label="Framework"
                      variant="outlined"
                      class="mb-3"
                      placeholder="e.g., TensorFlow, PyTorch, etc."
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- Model Configuration -->
            <v-card class="mb-4">
              <v-card-title>Model Configuration</v-card-title>
              <v-divider />
              <v-card-text>
                <v-alert type="info" variant="tonal" class="mb-4">
                  Configure your model's parameters and settings. These settings will be used during training and deployment.
                </v-alert>
                
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.learning_rate"
                      label="Learning Rate"
                      type="number"
                      step="0.001"
                      min="0"
                      variant="outlined"
                      class="mb-3"
                      placeholder="0.001"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.batch_size"
                      label="Batch Size"
                      type="number"
                      min="1"
                      variant="outlined"
                      class="mb-3"
                      placeholder="32"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.epochs"
                      label="Epochs"
                      type="number"
                      min="1"
                      variant="outlined"
                      class="mb-3"
                      placeholder="100"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.validation_split"
                      label="Validation Split"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      variant="outlined"
                      class="mb-3"
                      placeholder="0.2"
                    />
                  </v-col>
                </v-row>

                <v-textarea
                  v-model="formData.config.architecture"
                  label="Model Architecture"
                  variant="outlined"
                  rows="4"
                  class="mb-3"
                  placeholder="Describe your model's architecture or paste configuration JSON..."
                />
              </v-card-text>
            </v-card>

            <!-- Training Settings -->
            <v-card class="mb-4">
              <v-card-title>Training Settings</v-card-title>
              <v-divider />
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="formData.config.optimizer"
                      :items="optimizers"
                      label="Optimizer"
                      variant="outlined"
                      class="mb-3"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="formData.config.loss_function"
                      :items="lossFunctions"
                      label="Loss Function"
                      variant="outlined"
                      class="mb-3"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="formData.config.early_stopping"
                      label="Early Stopping"
                      color="primary"
                      class="mb-3"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="formData.config.data_augmentation"
                      label="Data Augmentation"
                      color="primary"
                      class="mb-3"
                    />
                  </v-col>
                </v-row>

                <v-textarea
                  v-model="formData.config.preprocessing"
                  label="Data Preprocessing"
                  variant="outlined"
                  rows="3"
                  class="mb-3"
                  placeholder="Describe any data preprocessing steps..."
                />
              </v-card-text>
            </v-card>

            <!-- Deployment Settings -->
            <v-card class="mb-4">
              <v-card-title>Deployment Settings</v-card-title>
              <v-divider />
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.config.instance_type"
                      label="Instance Type"
                      variant="outlined"
                      class="mb-3"
                      placeholder="t3.medium"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.replicas"
                      label="Number of Replicas"
                      type="number"
                      min="1"
                      max="10"
                      variant="outlined"
                      class="mb-3"
                      placeholder="1"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.timeout"
                      label="Request Timeout (seconds)"
                      type="number"
                      min="1"
                      variant="outlined"
                      class="mb-3"
                      placeholder="30"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.config.max_concurrent_requests"
                      label="Max Concurrent Requests"
                      type="number"
                      min="1"
                      variant="outlined"
                      class="mb-3"
                      placeholder="100"
                    />
                  </v-col>
                </v-row>

                <v-textarea
                  v-model="formData.config.environment_variables"
                  label="Environment Variables"
                  variant="outlined"
                  rows="3"
                  class="mb-3"
                  placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
                />
              </v-card-text>
            </v-card>
          </v-form>
        </div>
      </template>

      <template #sidebar>
        <ModelGuide page="edit" />
        
        <v-card class="mb-4">
          <v-card-title>Edit Guide</v-card-title>
          <v-card-text>
            <v-alert type="info" variant="tonal" class="mb-3">
              <strong>Tips for editing your model:</strong>
            </v-alert>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Name & Type
                </v-list-item-title>
                <v-list-item-subtitle>Choose a descriptive name and appropriate model type</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Configuration
                </v-list-item-title>
                <v-list-item-subtitle>Set hyperparameters that work best for your data</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Training
                </v-list-item-title>
                <v-list-item-subtitle>Configure optimizer, loss function, and training settings</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Deployment
                </v-list-item-title>
                <v-list-item-subtitle>Set resource requirements and scaling parameters</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Model Status</v-card-title>
          <v-card-text>
            <div class="d-flex align-center mb-3">
              <v-chip
                :color="getStatusColor(model?.status)"
                size="small"
                class="mr-2"
              >
                {{ model?.status || 'draft' }}
              </v-chip>
              <span class="text-body-2">Current Status</span>
            </div>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Created
                </v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(model?.created_at) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Last Updated
                </v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(model?.updated_at || model?.created_at) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Version
                </v-list-item-title>
                <v-list-item-subtitle>{{ model?.version || '1.0.0' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </template>
    </PageStructure>

    <!-- Success Snackbar -->
    <v-snackbar v-model="showSuccess" color="success" timeout="3000">
      Model updated successfully!
      <template #actions>
        <v-btn variant="text" @click="showSuccess = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
}

const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const model = ref<Model | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const showSuccess = ref(false)
const form = ref<any>(null)

// Form data
const formData = reactive({
  name: '',
  type: '',
  description: '',
  version: '',
  framework: '',
  config: {
    learning_rate: 0.001,
    batch_size: 32,
    epochs: 100,
    validation_split: 0.2,
    architecture: '',
    optimizer: 'adam',
    loss_function: 'categorical_crossentropy',
    early_stopping: true,
    data_augmentation: false,
    preprocessing: '',
    instance_type: 't3.medium',
    replicas: 1,
    timeout: 30,
    max_concurrent_requests: 100,
    environment_variables: ''
  }
})

// Options
const modelTypes = [
  'Classification',
  'Regression',
  'Neural Network',
  'Transformer',
  'Custom'
]

const optimizers = [
  'adam',
  'sgd',
  'rmsprop',
  'adagrad',
  'adamax'
]

const lossFunctions = [
  'categorical_crossentropy',
  'binary_crossentropy',
  'mean_squared_error',
  'mean_absolute_error',
  'sparse_categorical_crossentropy'
]

// Helper functions
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

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Action handlers
const saveModel = async () => {
  if (!form.value?.validate()) return

  saving.value = true
  error.value = null

  try {
    const { error: err } = await supabase
      .from('models')
      .update({
        name: formData.name,
        type: formData.type,
        description: formData.description,
        version: formData.version,
        framework: formData.framework,
        config: formData.config,
        updated_at: new Date().toISOString()
      })
      .eq('id', model.value?.id)
    
    if (err) {
      error.value = err.message
    } else {
      showSuccess.value = true
      // Update local model data
      if (model.value) {
        Object.assign(model.value, {
          name: formData.name,
          type: formData.type,
          description: formData.description,
          version: formData.version,
          framework: formData.framework,
          config: formData.config,
          updated_at: new Date().toISOString()
        })
      }
    }
  } catch (err) {
    error.value = 'Failed to update model'
  } finally {
    saving.value = false
  }
}

const cancelEdit = () => {
  router.push(`/models/${model.value?.id}`)
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
      // Populate form data
      formData.name = data.name || ''
      formData.type = data.type || ''
      formData.description = data.description || ''
      formData.version = data.version || ''
      formData.framework = data.framework || ''
      
      if (data.config) {
        Object.assign(formData.config, data.config)
      }
    }
  } catch (err) {
    error.value = 'Failed to load model details'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadModel()
})
</script>

<style scoped>
.edit-form {
  max-width: 100%;
}

.v-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .d-flex.gap-3 {
    flex-direction: column;
    gap: 1rem !important;
  }
  
  .d-flex.gap-3 .v-btn {
    width: 100%;
  }
}
</style> 