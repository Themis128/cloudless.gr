<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" class="mx-auto">
        <v-card>
          <v-card-title>Model Selection</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="saveModelSelection">
              <!-- Model Type Selection -->
              <v-radio-group
                v-model="modelType"
                inline
                class="mb-4"
              >
                <v-radio
                  label="Predefined Model"
                  value="predefined"
                />
                <v-radio
                  label="Custom Model"
                  value="custom"
                />
              </v-radio-group>

              <!-- Predefined Model Selection -->
              <v-select
                v-if="modelType === 'predefined'"
                v-model="selectedModel"
                :items="availableModels"
                label="Select Model"
                item-title="name"
                item-value="id"
                class="mb-4"
                :loading="loadingModels"
                :rules="[v => modelType === 'custom' || !!v || 'Model selection is required']"
                required
              />

              <!-- Custom Model Configuration -->
              <template v-if="modelType === 'custom'">
                <v-text-field
                  v-model="customModel.name"
                  label="Model Name"
                  class="mb-4"
                  :rules="[v => !!v || 'Model name is required']"
                  required
                />
                <v-text-field
                  v-model="customModel.endpoint"
                  label="API Endpoint"
                  class="mb-4"
                  :rules="[v => !!v || 'API endpoint is required']"
                  required
                />
                <v-select
                  v-model="customModel.type"
                  :items="modelTypes"
                  label="Model Type"
                  class="mb-4"
                  :rules="[v => !!v || 'Model type is required']"
                  required
                />
                <v-text-field
                  v-model="customModel.apiKey"
                  label="API Key"
                  type="password"
                  class="mb-4"
                  :rules="[v => !!v || 'API key is required']"
                  required
                />
              </template>

              <!-- Model Parameters -->
              <v-expansion-panels v-if="selectedModel || modelType === 'custom'">
                <v-expansion-panel>
                  <v-expansion-panel-title>Model Parameters</v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <v-slider
                      v-model="modelParams.temperature"
                      label="Temperature"
                      min="0"
                      max="1"
                      step="0.1"
                      thumb-label
                      class="mb-4"
                    >
                      <template #prepend>
                        <v-tooltip location="top" text="Controls the randomness in model outputs. Lower values (closer to 0) make the model more focused and deterministic, while higher values (closer to 1) make it more creative and diverse.">
                          <template #activator="{ props }">
                            <v-icon
                              v-bind="props"
                              icon="mdi-help-circle-outline"
                              class="me-2"
                            />
                          </template>
                        </v-tooltip>
                      </template>
                    </v-slider>
                    
                    <v-text-field
                      v-model="modelParams.maxTokens"
                      label="Max Tokens"
                      type="number"
                      min="1"
                      class="mb-4"
                    >
                      <template #prepend>
                        <v-tooltip location="top" text="Maximum number of tokens (words or word pieces) in the model's response. One token is roughly 4 characters or 3/4 of a word in English. Higher values allow for longer responses but may increase processing time and costs.">
                          <template #activator="{ props }">
                            <v-icon
                              v-bind="props"
                              icon="mdi-help-circle-outline"
                              class="me-2"
                            />
                          </template>
                        </v-tooltip>
                      </template>
                      <template #append>
                        <v-tooltip location="top" text="Estimated maximum words: ~{{ Math.round(modelParams.maxTokens * 0.75) }}">
                          <template #activator="{ props }">
                            <v-icon
                              v-bind="props"
                              icon="mdi-text-box-outline"
                              class="ms-2"
                            />
                          </template>
                        </v-tooltip>
                      </template>
                    </v-text-field>

                    <v-select
                      v-model="modelParams.outputFormat"
                      :items="outputFormats"
                      label="Output Format"
                      item-title="title"
                      item-value="value"
                      class="mb-4"
                    >
                      <template #prepend>
                        <v-tooltip location="top" text="The format in which the model will structure its response. Choose based on how you plan to process or display the output.">
                          <template #activator="{ props }">
                            <v-icon
                              v-bind="props"
                              icon="mdi-help-circle-outline"
                              class="me-2"
                            />
                          </template>
                        </v-tooltip>
                      </template>
                      <template #item="{ props, item }">
                        <v-list-item v-bind="props">
                          <v-list-item-title>{{ item.raw.title }}</v-list-item-title>
                          <v-list-item-subtitle>{{ item.raw.description }}</v-list-item-subtitle>
                        </v-list-item>
                      </template>
                    </v-select>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>

              <!-- Navigation Buttons -->
              <v-card-actions>
                <v-btn
                  color="secondary"
                  variant="outlined"
                  @click="goBack"
                >
                  Back
                </v-btn>
                <v-spacer />
                <v-btn
                  color="primary"
                  :loading="loading"
                  :disabled="!isValid"
                  @click="saveModelSelection"
                >
                  Continue
                </v-btn>
              </v-card-actions>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabase } from '~/composables/supabase'
import type { CustomModel, Model, ModelConfig, ModelParams } from '~/types/Pipeline'

const router = useRouter()
const supabase = useSupabase()
const loading = ref(false)
const loadingModels = ref(false)

const modelType = ref<'predefined' | 'custom'>('predefined')
const selectedModel = ref<string | null>(null)
const availableModels = ref<Model[]>([])
const modelTypes = ['gpt', 'llama', 'mistral', 'anthropic', 'other']

const customModel = ref<CustomModel>({
  name: '',
  endpoint: '',
  type: '',
  apiKey: ''
})

const modelParams = ref<ModelParams>({
  temperature: 0.7,
  maxTokens: 1000,
  outputFormat: 'json'
})

const outputFormats = [
  { value: 'json', title: 'JSON', description: 'Structured data format, best for parsing and data processing' },
  { value: 'text', title: 'Plain Text', description: 'Simple text output without formatting' },
  { value: 'markdown', title: 'Markdown', description: 'Rich text with formatting, headers, lists, and code blocks' },
  { value: 'html', title: 'HTML', description: 'Web-ready format with HTML tags and styling' }
]

const isValid = computed(() => {
  if (modelType.value === 'predefined') {
    return selectedModel.value != null
  } else {
    return customModel.value.name && 
           customModel.value.endpoint && 
           customModel.value.type && 
           customModel.value.apiKey
  }
})

onMounted(async () => {
  loadingModels.value = true
  try {
    const { data, error } = await supabase
      .from('models')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    availableModels.value = data || []
  } catch (error) {
    // console.error('Error loading models:', error)
  } finally {
    loadingModels.value = false
  }
})

const goBack = () => {
  router.push('/pipelines/create/details')
}

const saveModelSelection = async () => {
  if (!isValid.value) return
  
  loading.value = true
  try {
    const modelConfig: ModelConfig = {
      type: modelType.value,
      ...(modelType.value === 'predefined' 
        ? {
            modelId: selectedModel.value!,
            params: modelParams.value
          }
        : {
            customModel: customModel.value,
            params: modelParams.value
          }
      )
    }
    localStorage.setItem('pipelineModelConfig', JSON.stringify(modelConfig))
    router.push('/pipelines/create/config')
  } catch (error) {
    // console.error('Error saving model selection:', error)
  } finally {
    loading.value = false
  }
}
</script> 