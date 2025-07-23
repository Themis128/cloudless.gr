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
                  label="Model Name"
                  required
                  :rules="[v => !!v || 'Name is required']"
                />
                <v-textarea
                  v-model="form.description"
                  label="Description"
                  rows="3"
                />
                <v-select
                  v-model="form.type"
                  :items="modelTypes"
                  label="Model Type"
                  required
                  :rules="[v => !!v || 'Type is required']"
                />
              </v-form>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 2: Framework & Version -->
        <v-stepper-window-item :value="2">
          <v-card class="mb-4">
            <v-card-text>
              <v-select
                v-model="form.framework"
                :items="frameworks"
                label="Framework"
                required
                :rules="[v => !!v || 'Framework is required']"
              />
              <v-text-field
                v-model="form.version"
                label="Version"
                placeholder="1.0.0"
                required
                :rules="[v => !!v || 'Version is required']"
              />
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 3: Configuration -->
        <v-stepper-window-item :value="3">
          <v-card class="mb-4">
            <v-card-text>
              <v-textarea
                v-model="jsonConfig"
                label="Model Configuration (JSON)"
                rows="10"
                :error-messages="jsonError ? [jsonError] : []"
                @input="validateJson"
              />
              <v-alert v-if="!jsonError" type="info" class="mt-4">
                Configuration is valid JSON
              </v-alert>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 4: Review -->
        <v-stepper-window-item :value="4">
          <v-card class="mb-4">
            <v-card-text>
              <h3>Model Summary</h3>
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
                  <v-list-item-title>Type</v-list-item-title>
                  <v-list-item-subtitle>{{ form.type }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Framework</v-list-item-title>
                  <v-list-item-subtitle>{{ form.framework }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Version</v-list-item-title>
                  <v-list-item-subtitle>{{ form.version }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item>
                  <v-list-item-title>Configuration</v-list-item-title>
                  <v-list-item-subtitle>
                    <pre>{{ JSON.stringify(parsedConfig, null, 2) }}</pre>
                  </v-list-item-subtitle>
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
          :disabled="!canProceed"
          @click="handleNext"
        >
          {{ currentStep === steps.length ? 'Create Model' : 'Next' }}
        </v-btn>
      </div>
    </v-stepper>

    <v-alert v-if="error" type="error" class="mt-4">
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePrismaStore } from '~/stores/usePrismaStore'

const emit = defineEmits<{
  'created': []
}>()

const { createModel } = usePrismaStore()

const currentStep = ref(1)
const error = ref<string | null>(null)
const jsonError = ref<string | null>(null)

const steps = [
  { title: 'Basic Info', subtitle: 'Name and description' },
  { title: 'Framework', subtitle: 'Framework and version' },
  { title: 'Configuration', subtitle: 'Model setup' },
  { title: 'Review', subtitle: 'Verify details' }
]

const modelTypes = [
  'classification',
  'regression',
  'clustering',
  'nlp',
  'cv',
  'recommendation',
  'time-series',
  'custom'
]

const frameworks = [
  'tensorflow',
  'pytorch',
  'scikit-learn',
  'xgboost',
  'lightgbm',
  'transformers',
  'custom'
]

const form = ref({
  name: '',
  description: '',
  type: '',
  framework: '',
  version: '1.0.0',
  config: {} as any
})

const defaultConfig = {
  architecture: 'transformer',
  parameters: {
    epochs: 10,
    batch_size: 32,
    learning_rate: 0.001,
    optimizer: 'adam'
  },
  data: {
    train_split: 0.8,
    validation_split: 0.1,
    test_split: 0.1
  }
}

const jsonConfig = ref(JSON.stringify(defaultConfig, null, 2))

const parsedConfig = computed(() => {
  try {
    return JSON.parse(jsonConfig.value)
  } catch {
    return null
  }
})

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return !!form.value.name && !!form.value.type
  }
  if (currentStep.value === 2) {
    return !!form.value.framework && !!form.value.version
  }
  if (currentStep.value === 3) {
    return !jsonError.value && !!parsedConfig.value
  }
  return true
})

const validateJson = () => {
  try {
    JSON.parse(jsonConfig.value)
    jsonError.value = null
  } catch (err: any) {
    jsonError.value = 'Invalid JSON: ' + err.message
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

const submit = async () => {
  error.value = null
  
  try {
    form.value.config = parsedConfig.value

    await createModel({
      name: form.value.name,
      description: form.value.description,
      type: form.value.type,
      config: {
        framework: form.value.framework,
        version: form.value.version,
        ...form.value.config
      },
      status: 'draft',
      userId: 1 // Default user ID for now
    })

    emit('created')
  } catch (err: any) {
    error.value = err.message || 'Failed to create model'
  }
}
</script>
