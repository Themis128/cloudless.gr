<template>
  <div>
    <v-stepper v-model="currentStep" class="mb-6">
      <v-stepper-header>
        <template v-for="(step, i) in steps" :key="i">
          <v-stepper-item :value="i + 1" :complete="currentStep > i + 1" :title="step.title">
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
              <!-- Pipeline Basic Info Guide -->
              <v-card class="mb-4" variant="outlined">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  📖 Read the Pipeline Basic Info Guide
                </v-card-title>
                <v-card-text>
                  <div class="text-body-2">
                    <p class="mb-2"><strong>Define your pipeline's basic information:</strong></p>
                    <ul class="mb-3">
                      <li>
                        <strong>Pipeline Name:</strong> Choose a descriptive name that clearly
                        identifies your pipeline's purpose
                      </li>
                      <li>
                        <strong>Description:</strong> Provide a brief overview of what your pipeline
                        does and its workflow
                      </li>
                    </ul>
                    <v-alert type="info" variant="tonal" class="mb-2">
                      <strong>💡 Tip:</strong> Use clear, specific names and detailed descriptions
                      to help others understand your pipeline's workflow.
                    </v-alert>
                  </div>
                </v-card-text>
              </v-card>

              <v-form @submit.prevent>
                <v-text-field
                  v-model="form.name"
                  label="Pipeline Name"
                  required
                  :rules="[v => !!v || 'Name is required']"
                />
                <v-textarea v-model="form.description" label="Description" rows="3" />
              </v-form>
            </v-card-text>
          </v-card>
        </v-stepper-window-item>

        <!-- Step 2: Model Selection -->
        <v-stepper-window-item :value="2">
          <v-card class="mb-4">
            <v-card-text>
              <!-- Model Selection Guide -->
              <v-card class="mb-4" variant="outlined">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  📖 Read the Model Selection Guide
                </v-card-title>
                <v-card-text>
                  <div class="text-body-2">
                    <p class="mb-2">
                      <strong>Select a model for your pipeline (optional):</strong>
                    </p>
                    <ul class="mb-3">
                      <li>
                        <strong>Model Integration:</strong> Choose a model to integrate with your
                        pipeline
                      </li>
                      <li>
                        <strong>Optional Selection:</strong> You can create a pipeline without a
                        specific model
                      </li>
                      <li>
                        <strong>Compatibility:</strong> Ensure the model is compatible with your
                        pipeline's requirements
                      </li>
                    </ul>
                    <v-alert type="info" variant="tonal" class="mb-2">
                      <strong>💡 Tip:</strong> Select a model that aligns with your pipeline's
                      purpose and data processing requirements.
                    </v-alert>
                  </div>
                </v-card-text>
              </v-card>

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
              <!-- Pipeline Configuration Guide -->
              <v-card class="mb-4" variant="outlined">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  📖 Read the Pipeline Configuration Guide
                </v-card-title>
                <v-card-text>
                  <div class="text-body-2">
                    <p class="mb-2">
                      <strong>Configure your pipeline's workflow and settings:</strong>
                    </p>
                    <ul class="mb-3">
                      <li>
                        <strong>JSON Configuration:</strong> Define pipeline steps, data flow, and
                        processing rules
                      </li>
                      <li>
                        <strong>Validation:</strong> Ensure your JSON is properly formatted and
                        valid
                      </li>
                      <li>
                        <strong>Workflow Design:</strong> Design the sequence of operations and data
                        transformations
                      </li>
                    </ul>
                    <v-alert type="info" variant="tonal" class="mb-2">
                      <strong>💡 Tip:</strong> Use valid JSON format and design a clear workflow
                      that defines how data flows through your pipeline.
                    </v-alert>
                  </div>
                </v-card-text>
              </v-card>

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
              <!-- Review & Create Guide -->
              <v-card class="mb-4" variant="outlined">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  📖 Read the Review & Create Guide
                </v-card-title>
                <v-card-text>
                  <div class="text-body-2">
                    <p class="mb-2">
                      <strong>Review your pipeline configuration before creating:</strong>
                    </p>
                    <ul class="mb-3">
                      <li>Verify all information is correct and complete</li>
                      <li>Check that the pipeline name and description are clear</li>
                      <li>Review the configuration for accuracy and completeness</li>
                      <li>Confirm model selection (if any) is appropriate</li>
                    </ul>
                    <v-alert type="success" variant="tonal" class="mb-2">
                      <strong>✅ Ready to Create:</strong> Your pipeline will be created with the
                      specified configuration. You can deploy and test it after creation.
                    </v-alert>
                  </div>
                </v-card-text>
              </v-card>

              <v-card variant="outlined">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  📋 Pipeline Configuration Summary
                </v-card-title>
                <v-card-text>
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
            </v-card-text>
          </v-card>
        </v-stepper-window-item>
      </v-stepper-window>

      <div class="d-flex justify-space-between mt-4">
        <v-btn color="primary" variant="outlined" :disabled="currentStep === 1" @click="goBack">
          Back
        </v-btn>
        <v-btn color="primary" :disabled="!canProceed" @click="handleNext">
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
  import { computed, onMounted, ref } from 'vue'
  import { useModelStore } from '~/stores/modelStore'
  import { usePipelineStore } from '~/stores/pipelineStore'
  // import type { PipelineConfig } from '~/types/Pipeline';

  const props = defineProps<{
    projectId?: string
  }>()

  const emit = defineEmits<{
    created: []
  }>()

  const pipelineStore = usePipelineStore()
  const modelStore = useModelStore()

  const currentStep = ref(1)
  const error = ref<string | null>(null)
  const jsonError = ref<string | null>(null)
  const modelOptions = ref<{ id: string; name: string }[]>([])

  const steps = [
    { title: 'Basic Info', subtitle: 'Name and description' },
    { title: 'Model', subtitle: 'Select model' },
    { title: 'Configuration', subtitle: 'Pipeline setup' },
    { title: 'Review', subtitle: 'Verify details' },
  ]

  const form = ref({
    name: '',
    description: '',
    model: '',
    config: {} as any,
  })

  const defaultConfig = {
    steps: [
      {
        name: 'Parse User Query',
        type: 'input_processor',
        config: {
          extract_code_context: true,
          identify_language: true,
        },
      },
      {
        name: 'Generate Response',
        type: 'llm_processor',
        config: {
          temperature: 0.7,
          max_tokens: 1000,
          include_code_blocks: true,
          format: 'markdown',
        },
      },
      {
        name: 'Format Output',
        type: 'output_processor',
        config: {
          highlight_code: true,
          add_explanations: true,
          format_markdown: true,
        },
      },
    ],
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

      await pipelineStore.createPipeline({
        name: form.value.name,
        description: form.value.description,
        config: JSON.stringify(form.value.config),
        status: 'draft',
        userId: 1, // Default user ID for now
      })

      emit('created')
    } catch (err: any) {
      error.value = err.message || 'Failed to create pipeline'
    }
  }

  onMounted(async () => {
    // Reset store state when component mounts
    pipelineStore.resetBuilder()

    // Fetch models for selection
    if (modelStore.allModels.length === 0) {
      await modelStore.fetchAll()
    }

    // Populate model options
    modelOptions.value = modelStore.allModels.map(model => ({
      id: model.id.toString(),
      name: model.name,
    }))
  })
</script>
