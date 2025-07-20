<template>
  <div>
    <v-stepper v-model="currentStep" class="mb-6">
      <v-stepper-header>
        <template v-for="(step, i) in steps" :key="i">
          <v-stepper-item
            :value="i + 1"
            :complete="currentStep > i + 1"
            :title="step.title"
          >
            {{ step.title }}
          </v-stepper-item>
          <v-divider v-if="i < steps.length - 1" />
        </template>
      </v-stepper-header>

      <v-stepper-window>
        <!-- Step 1: Basic Info -->
        <v-stepper-window-item :value="1">
          <v-card class="mb-4">
            <v-card-text>
              <v-form @submit.prevent>
                <v-text-field
                  v-model="form.name"
                  label="LLM Name"
                  required
                  :rules="[v => !!v || 'Name is required']"
                />
                <v-textarea
                  v-model="form.description"
                  label="Description"
                  rows="3"
                />
                <v-select
                  v-model="form.baseModel"
                  :items="baseModels"
                  label="Base Model"
                  required
                  :rules="[v => !!v || 'Base model is required']"
                />
              </v-form>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 2: Training Configuration -->
        <v-stepper-window-item :value="2">
          <v-card class="mb-4">
            <v-card-text>
              <v-select
                v-model="form.trainingType"
                :items="trainingTypes"
                label="Training Type"
                required
                :rules="[v => !!v || 'Training type is required']"
              />
              <v-text-field
                v-model.number="form.epochs"
                label="Epochs"
                type="number"
                min="1"
                max="100"
                required
                :rules="[v => v >= 1 && v <= 100 || 'Epochs must be between 1 and 100']"
              />
              <v-text-field
                v-model.number="form.batchSize"
                label="Batch Size"
                type="number"
                min="1"
                max="128"
                required
                :rules="[v => v >= 1 && v <= 128 || 'Batch size must be between 1 and 128']"
              />
              <v-text-field
                v-model.number="form.learningRate"
                label="Learning Rate"
                type="number"
                step="0.0001"
                min="0.0001"
                max="0.1"
                required
                :rules="[v => v >= 0.0001 && v <= 0.1 || 'Learning rate must be between 0.0001 and 0.1']"
              />
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 3: Data Configuration -->
        <v-stepper-window-item :value="3">
          <v-card class="mb-4">
            <v-card-text>
              <v-file-input
                v-model="trainingData"
                label="Training Data"
                accept=".json,.csv,.txt"
                :rules="[v => !!v || 'Training data is required']"
                show-size
                counter
              />
              <v-textarea
                v-model="form.dataConfig"
                label="Data Configuration (JSON)"
                rows="6"
                :error-messages="dataConfigError ? [dataConfigError] : []"
                @input="validateDataConfig"
              />
              <v-alert v-if="!dataConfigError && form.dataConfig" type="info" class="mt-4">
                Data configuration is valid JSON
              </v-alert>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 4: Review -->
        <v-stepper-window-item :value="4">
          <v-card class="mb-4">
            <v-card-text>
              <h3>LLM Training Summary</h3>
              <v-list>
                <v-list-item>
                  <v-list-item-title>Name</v-list-item-title>
                  <v-list-item-subtitle>{{ form.name }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="form.description">
                  <v-list-item-title>Description</v-list-item-title>
                  <v-list-item-subtitle>{{ form.description }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Base Model</v-list-item-title>
                  <v-list-item-subtitle>{{ form.baseModel }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Training Type</v-list-item-title>
                  <v-list-item-subtitle>{{ form.trainingType }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Epochs</v-list-item-title>
                  <v-list-item-subtitle>{{ form.epochs }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Batch Size</v-list-item-title>
                  <v-list-item-subtitle>{{ form.batchSize }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Learning Rate</v-list-item-title>
                  <v-list-item-subtitle>{{ form.learningRate }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="trainingData">
                  <v-list-item-title>Training Data</v-list-item-title>
                  <v-list-item-subtitle>{{ trainingData.name }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>
      </v-stepper-window>

      <div class="d-flex justify-space-between mt-4">
        <v-btn
          color="primary"
          variant="outlined"
          :disabled="currentStep === 1"
          @click="goBack"
        >
          Back
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          :disabled="!canProceed"
          @click="handleNext"
        >
          {{ currentStep === steps.length ? 'Start Training' : 'Next' }}
        </v-btn>
      </div>
    </v-stepper>

    <v-alert v-if="error" type="error" class="mt-4">
      {{ error }}
    </v-alert>
    <v-alert v-if="success" type="success" class="mt-4">
      LLM training started successfully!
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const emit = defineEmits<{
  'created': []
}>()

const currentStep = ref(1)
const error = ref<string | null>(null)
const success = ref(false)
const loading = ref(false)
const dataConfigError = ref<string | null>(null)
const trainingData = ref<File | null>(null)

const steps = [
  { title: 'Basic Info', subtitle: 'Name and base model' },
  { title: 'Training Config', subtitle: 'Training parameters' },
  { title: 'Data Config', subtitle: 'Training data setup' },
  { title: 'Review', subtitle: 'Verify details' }
]

const baseModels = [
  'gpt-3.5-turbo',
  'gpt-4',
  'claude-3-sonnet',
  'llama-2-7b',
  'llama-2-13b',
  'llama-2-70b',
  'custom'
]

const trainingTypes = [
  'fine-tuning',
  'instruction-tuning',
  'reinforcement-learning',
  'custom'
]

const form = ref({
  name: '',
  description: '',
  baseModel: '',
  trainingType: '',
  epochs: 10,
  batchSize: 16,
  learningRate: 0.001,
  dataConfig: JSON.stringify({
    data_format: 'json',
    input_column: 'input',
    output_column: 'output',
    validation_split: 0.1,
    test_split: 0.1
  }, null, 2)
})

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return !!form.value.name && !!form.value.baseModel
  }
  if (currentStep.value === 2) {
    return !!form.value.trainingType && 
           form.value.epochs >= 1 && form.value.epochs <= 100 &&
           form.value.batchSize >= 1 && form.value.batchSize <= 128 &&
           form.value.learningRate >= 0.0001 && form.value.learningRate <= 0.1
  }
  if (currentStep.value === 3) {
    return !!trainingData.value && !dataConfigError.value
  }
  return true
})

const validateDataConfig = () => {
  try {
    JSON.parse(form.value.dataConfig)
    dataConfigError.value = null
  } catch (err: any) {
    dataConfigError.value = 'Invalid JSON: ' + err.message
  }
}

const goBack = () => {
  currentStep.value--
}

const handleNext = () => {
  if (currentStep.value === steps.length) {
    submit()
  } else {
    currentStep.value++
  }
}

interface UserResponse {
  data: {
    user: {
      id: string
    } | null
  }
}

interface TrainingResponse {
  success: boolean
  data?: {
    sessionId: string
    jobId: string
    status: string
    message: string
  }
  message?: string
}

const submit = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    const userResponse = await $fetch<UserResponse>('/api/auth/user')
    const ownerId = userResponse.data?.user?.id || 'system'

    const response = await $fetch<TrainingResponse>('/api/models/train', {
      method: 'POST',
      body: {
        name: form.value.name,
        baseModel: form.value.baseModel,
        trainingType: form.value.trainingType,
        description: form.value.description,
        parameters: {
          epochs: form.value.epochs,
          batchSize: form.value.batchSize,
          learningRate: form.value.learningRate,
          useEarlyStop: true
        },
        dataConfig: JSON.parse(form.value.dataConfig),
        ownerId
      }
    })

    if (response.success) {
      success.value = true
      emit('created')
    } else {
      throw new Error(response.message || 'Failed to start training')
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to start LLM training'
  } finally {
    loading.value = false
  }
}
</script>
