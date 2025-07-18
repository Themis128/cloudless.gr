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
                  label="Pipeline Name"
                  required
                  :rules="[v => !!v || 'Name is required']"
                />
                <v-textarea
                  v-model="form.description"
                  label="Description"
                  rows="3"
                />
              </v-form>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 2: Model Selection -->
        <v-stepper-window-item :value="2">
          <v-card class="mb-4">
            <v-card-text>
              <v-select
                v-model="form.model"
                :items="modelOptions"
                item-title="name"
                item-value="id"
                label="Select Model (Optional)"
                clearable
              />
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 3: Pipeline Configuration -->
        <v-stepper-window-item :value="3">
          <v-card class="mb-4">
            <v-card-text>
              <v-textarea
                v-model="jsonConfig"
                label="Pipeline Configuration (JSON)"
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
              <h3>Pipeline Summary</h3>
              <v-list>
                <v-list-item>
                  <v-list-item-title>Name</v-list-item-title>
                  <v-list-item-subtitle>{{ form.name }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="form.description">
                  <v-list-item-title>Description</v-list-item-title>
                  <v-list-item-subtitle>{{ form.description }}</v-list-item-subtitle>
                </v-list-item>
                <v-list-item v-if="form.model">
                  <v-list-item-title>Model</v-list-item-title>
                  <v-list-item-subtitle>{{ getModelName(form.model) }}</v-list-item-subtitle>
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
          {{ currentStep === steps.length ? 'Create Pipeline' : 'Next' }}
        </v-btn>
      </div>
    </v-stepper>

    <v-alert v-if="error" type="error" class="mt-4">
      {{ error }}
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSupabase } from '~/composables/supabase';
import { usePipelineStore } from '~/stores/pipelineStore';
// import type { PipelineConfig } from '~/types/Pipeline';

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  'created': []
}>()

const supabase = useSupabase()
const pipelineStore = usePipelineStore()

const currentStep = ref(1)
const error = ref<string | null>(null)
const jsonError = ref<string | null>(null)
const modelOptions = ref<{ id: string; name: string }[]>([])

const steps = [
  { title: 'Basic Info', subtitle: 'Name and description' },
  { title: 'Model', subtitle: 'Select model' },
  { title: 'Configuration', subtitle: 'Pipeline setup' },
  { title: 'Review', subtitle: 'Verify details' }
]

const form = ref({
  name: '',
  description: '',
  model: '',
  config: {} as any
})

const defaultConfig = {
  steps: [
    {
      name: 'Parse User Query',
      type: 'input_processor',
      config: {
        extract_code_context: true,
        identify_language: true
      }
    },
    {
      name: 'Generate Response',
      type: 'llm_processor',
      config: {
        temperature: 0.7,
        max_tokens: 1000,
        include_code_blocks: true,
        format: 'markdown'
      }
    },
    {
      name: 'Format Output',
      type: 'output_processor',
      config: {
        highlight_code: true,
        add_explanations: true,
        format_markdown: true
      }
    }
  ]
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
    return !!form.value.name
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

const getModelName = (id: string) => {
  return modelOptions.value.find(m => m.id === id)?.name || id
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

    const result = await pipelineStore.create({
      name: form.value.name,
      description: form.value.description,
      model: form.value.model,
      config: form.value.config,
      project_id: props.projectId
    })

    if (!result.success) {
      throw new Error(result.error)
    }

    emit('created')
  } catch (err: any) {
    error.value = err.message
  }
}

onMounted(async () => {
  // Fetch available models
  const { data, error: err } = await supabase
    .from('models')
    .select('id, name')
    .order('created_at', { ascending: false })
  
  if (!err && data) {
    modelOptions.value = data
  }
})
</script>
