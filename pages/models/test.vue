<template>
  <div>
    <LayoutPageStructure
      title="Test Model"
      subtitle="Test your trained models with sample data"
      back-button-to="/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Model Selection -->
        <v-card class="mb-4">
          <v-card-title>Select Model to Test</v-card-title>
          <v-divider />
          <v-card-text>
            <v-select
              v-model="selectedModel"
              :items="availableModels"
              item-title="name"
              item-value="id"
              label="Choose a Model"
              variant="outlined"
              class="mb-3"
              :loading="loadingModels"
              :disabled="loadingModels"
              prepend-icon="mdi-brain"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-avatar color="primary" size="32">
                      <v-icon color="white">
                        {{ getModelIcon(item.raw.type) }}
                      </v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ item.raw.type }} • v{{ item.raw.version }}
                  </v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>
            
            <v-alert
              v-if="selectedModelInfo"
              type="info"
              variant="tonal"
              class="mb-3"
            >
              <strong>Model Info:</strong> {{ selectedModelInfo.type }} model trained on {{ selectedModelInfo.framework || 'custom framework' }}
            </v-alert>
          </v-card-text>
        </v-card>

        <!-- Test Input -->
        <v-card v-if="selectedModel" class="mb-4">
          <v-card-title>Test Input</v-card-title>
          <v-divider />
          <v-card-text>
            <v-alert type="info" variant="tonal" class="mb-4">
              <strong>Input Format:</strong> {{ getInputFormat() }}
            </v-alert>
            
            <v-textarea
              v-model="testInput"
              label="Input Data"
              variant="outlined"
              rows="6"
              class="mb-3"
              :placeholder="getInputPlaceholder()"
              :disabled="testing"
            />
            
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="maxTokens"
                  label="Max Tokens"
                  type="number"
                  min="1"
                  max="4096"
                  variant="outlined"
                  class="mb-3"
                  :disabled="testing"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="temperature"
                  label="Temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  variant="outlined"
                  class="mb-3"
                  :disabled="testing"
                />
              </v-col>
            </v-row>
            
            <div class="d-flex gap-3">
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-play"
                :loading="testing"
                :disabled="!selectedModel || !testInput.trim()"
                @click="testModel"
              >
                Test Model
              </v-btn>
              <v-btn
                color="secondary"
                variant="outlined"
                prepend-icon="mdi-refresh"
                :disabled="testing"
                @click="clearResults"
              >
                Clear Results
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Test Results -->
        <v-card v-if="testResults.length > 0">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Test Results</span>
            <v-chip color="success" size="small">
              {{ testResults.length }} test{{ testResults.length > 1 ? 's' : '' }}
            </v-chip>
          </v-card-title>
          <v-divider />
          <v-card-text>
            <div v-for="(result, index) in testResults" :key="index" class="mb-4">
              <v-card variant="outlined" class="mb-3">
                <v-card-title class="text-subtitle-1">
                  Test #{{ index + 1 }}
                  <v-chip
                    :color="result.success ? 'success' : 'error'"
                    size="small"
                    class="ml-2"
                  >
                    {{ result.success ? 'Success' : 'Error' }}
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <div class="mb-3">
                    <strong>Input:</strong>
                    <div class="text-body-2 bg-grey-lighten-4 p-2 rounded mt-1">
                      {{ result.input }}
                    </div>
                  </div>
                  
                  <div v-if="result.success" class="mb-3">
                    <strong>Output:</strong>
                    <div class="text-body-2 bg-green-lighten-5 p-2 rounded mt-1">
                      {{ result.output }}
                    </div>
                  </div>
                  
                  <div v-if="result.error" class="mb-3">
                    <strong>Error:</strong>
                    <div class="text-body-2 bg-red-lighten-5 p-2 rounded mt-1">
                      {{ result.error }}
                    </div>
                  </div>
                  
                  <div class="d-flex gap-4 text-caption text-medium-emphasis">
                    <span>
                      <v-icon size="16" class="mr-1">mdi-clock</v-icon>
                      {{ result.duration }}ms
                    </span>
                    <span>
                      <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                      {{ formatDate(result.timestamp) }}
                    </span>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Alert -->
        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
      </template>

      <template #sidebar>
        <ModelGuide page="test" />
        
        <v-card class="mb-4">
          <v-card-title>Test Settings</v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Max Tokens
                </v-list-item-title>
                <v-list-item-subtitle>Maximum output length (1-4096)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Temperature
                </v-list-item-title>
                <v-list-item-subtitle>Creativity level (0-2)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title class="text-caption">
                  Model Status
                </v-list-item-title>
                <v-list-item-subtitle>Only ready models can be tested</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>Quick Actions</v-card-title>
          <v-card-text>
            <v-btn
              to="/models"
              color="primary"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-arrow-left"
            >
              Back to Models
            </v-btn>
            <v-btn
              to="/models/create"
              color="success"
              variant="outlined"
              block
              class="mb-2"
              prepend-icon="mdi-plus"
            >
              Create New Model
            </v-btn>
            <v-btn
              to="/models/train"
              color="secondary"
              variant="outlined"
              block
              prepend-icon="mdi-school"
            >
              Train Model
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'

interface Model {
  id: number
  name: string
  type: string
  status: string
  description?: string
  config: string
  createdAt: Date
  updatedAt: Date
}

interface TestResult {
  input: string
  output?: string
  error?: string
  success: boolean
  duration: number
  timestamp: string
}

const availableModels = ref<Model[]>([])
const selectedModel = ref<number | null>(null)
const testInput = ref('')
const maxTokens = ref(100)
const temperature = ref(0.7)
const testing = ref(false)
const error = ref<string | null>(null)
const testResults = ref<TestResult[]>([])
const loadingModels = ref(false)

// Computed properties
const selectedModelInfo = computed(() => {
  return availableModels.value.find(model => model.id === selectedModel.value)
})

// Helper functions
const getModelIcon = (type?: string) => {
  const icons: Record<string, string> = {
    'Classification': 'mdi-tag-multiple',
    'Regression': 'mdi-chart-line',
    'Neural Network': 'mdi-brain',
    'Transformer': 'mdi-transformer',
    'Custom': 'mdi-cog'
  }
  return icons[type || ''] || 'mdi-brain'
}

const getInputFormat = () => {
  if (!selectedModelInfo.value) return 'Text input'
  
  const type = selectedModelInfo.value.type
  switch (type) {
    case 'Classification':
      return 'Text to classify'
    case 'Regression':
      return 'Numerical input values'
    case 'Neural Network':
      return 'Text or structured data'
    default:
      return 'Text input'
  }
}

const getInputPlaceholder = () => {
  if (!selectedModelInfo.value) return 'Enter your test input here...'
  
  const type = selectedModelInfo.value.type
  switch (type) {
    case 'Classification':
      return 'Enter text to classify (e.g., "This is a positive review")'
    case 'Regression':
      return 'Enter numerical values (e.g., "feature1: 0.5, feature2: 0.3")'
    case 'Neural Network':
      return 'Enter your input data here...'
    default:
      return 'Enter your test input here...'
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Action handlers
const testModel = async () => {
  if (!selectedModel.value || !testInput.value.trim()) return
  
  testing.value = true
  error.value = null
  
  const startTime = Date.now()
  
  try {
    // Simulate model testing - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    const duration = Date.now() - startTime
    
    // Mock response based on model type
    let output = ''
    let success = true
    let testError: string | undefined = undefined
    
    const modelType = selectedModelInfo.value?.type
    
    if (Math.random() > 0.1) { // 90% success rate
      switch (modelType) {
        case 'Classification':
          output = `Classification: ${['Positive', 'Negative', 'Neutral'][Math.floor(Math.random() * 3)]} (confidence: ${(Math.random() * 0.3 + 0.7).toFixed(2)})`
          break
        case 'Regression':
          output = `Prediction: ${(Math.random() * 100).toFixed(2)}`
          break
        case 'Neural Network':
          output = `Generated response: This is a sample output from the neural network model based on your input: "${testInput.value.substring(0, 50)}..."`
          break
        default:
          output = `Model output: Processed input "${testInput.value.substring(0, 30)}..."`
      }
    } else {
      success = false
      testError = 'Model inference failed: Internal server error'
    }
    
    const result: TestResult = {
      input: testInput.value,
      output: success ? output : undefined,
      error: testError,
      success,
      duration,
      timestamp: new Date().toISOString()
    }
    
    testResults.value.unshift(result)
    
    // Clear input for next test
    testInput.value = ''
    
  } catch (err) {
    error.value = 'Failed to test model'
  } finally {
    testing.value = false
  }
}

const clearResults = () => {
  testResults.value = []
  error.value = null
}

// Load available models
const loadModels = async () => {
  loadingModels.value = true
  error.value = null
  
  try {
    const response = await $fetch<{ success: boolean; data: Model[]; message?: string }>('/api/prisma/models?status=ready')
    
    if (response.success) {
      availableModels.value = response.data || []
    } else {
      error.value = response.message || 'Failed to load models'
    }
  } catch (err: any) {
    console.error('Error loading models:', err)
    error.value = err.message || 'Failed to load models'
  } finally {
    loadingModels.value = false
  }
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.test-results {
  max-height: 400px;
  overflow-y: auto;
}

.v-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style> 