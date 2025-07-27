<template>
  <div>
    <PageStructure
      :title="`Test ${model?.name || 'Model'}`"
      subtitle="Test and evaluate model performance"
      back-button-to="/llm/models"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">
            Loading model details...
          </p>
        </div>

        <!-- Model Not Found -->
        <div v-else-if="!model" class="text-center py-8">
          <v-icon size="64" color="error" class="mb-4">
            mdi-alert-circle
          </v-icon>
          <h2 class="text-h5 mb-2">
            Model Not Found
          </h2>
          <p class="text-body-1 mb-4">
            The model you're looking for doesn't exist or has been removed.
          </p>
          <v-btn color="primary" to="/llm/models">
            Back to Models
          </v-btn>
        </div>

        <!-- Testing Interface -->
        <div v-else>
          <!-- Model Info -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-brain
              </v-icon>
              Model Information
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Name:</strong> {{ model.name }}
                  </div>
                  <div class="mb-4">
                    <strong>Type:</strong>
                    <v-chip
                      color="info"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ model.type }}
                    </v-chip>
                  </div>
                  <div class="mb-4">
                    <strong>Accuracy:</strong> {{ model.accuracy }}%
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ model.base_model }}
                  </div>
                  <div class="mb-4">
                    <strong>Status:</strong>
                    <v-chip
                      :color="getStatusColor(model.status)"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ model.status }}
                    </v-chip>
                  </div>
                  <div class="mb-4">
                    <strong>Created:</strong> {{ formatDate(model.created_at) }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Testing Interface -->
          <v-row>
            <v-col cols="12" md="6">
              <v-card class="mb-4">
                <v-card-title class="text-h6">
                  <v-icon start color="primary">
                    mdi-play-circle
                  </v-icon>
                  Test Input
                </v-card-title>
                <v-card-text>
                  <v-form ref="testForm">
                    <v-textarea
                      v-model="testInput.prompt"
                      label="Input Text"
                      variant="outlined"
                      rows="6"
                      placeholder="Enter your test input here..."
                      required
                    />
                    
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="testInput.maxTokens"
                          label="Max Tokens"
                          variant="outlined"
                          type="number"
                          min="1"
                          max="2048"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="testInput.temperature"
                          label="Temperature"
                          variant="outlined"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                        />
                      </v-col>
                    </v-row>

                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="testInput.topP"
                          label="Top P"
                          variant="outlined"
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="testInput.frequencyPenalty"
                          label="Frequency Penalty"
                          variant="outlined"
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                        />
                      </v-col>
                    </v-row>

                    <div class="d-flex gap-3 mt-4">
                      <v-btn
                        color="primary"
                        prepend-icon="mdi-play"
                        variant="elevated"
                        size="large"
                        :loading="testing"
                        @click="runTest"
                      >
                        Run Test
                      </v-btn>
                      <v-btn
                        color="secondary"
                        prepend-icon="mdi-refresh"
                        variant="outlined"
                        size="large"
                        @click="resetForm"
                      >
                        Reset
                      </v-btn>
                    </div>
                  </v-form>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="6">
              <v-card class="mb-4">
                <v-card-title class="text-h6">
                  <v-icon start color="primary">
                    mdi-text-box-outline
                  </v-icon>
                  Test Results
                </v-card-title>
                <v-card-text>
                  <div v-if="!testResult" class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-text-box-outline
                    </v-icon>
                    <p>Test results will appear here</p>
                    <p class="text-caption text-medium-emphasis">
                      Run a test to see the model output
                    </p>
                  </div>
                  <div v-else>
                    <div class="mb-4">
                      <strong>Generated Text:</strong>
                      <div class="mt-2 p-3 bg-grey-lighten-4 rounded">
                        {{ testResult.text }}
                      </div>
                    </div>
                    
                    <v-divider class="my-4" />
                    
                    <div class="mb-4">
                      <strong>Usage Statistics:</strong>
                      <v-list density="compact" class="mt-2">
                        <v-list-item class="px-0">
                          <v-list-item-title>Prompt Tokens: {{ testResult.usage.promptTokens }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item class="px-0">
                          <v-list-item-title>Completion Tokens: {{ testResult.usage.completionTokens }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item class="px-0">
                          <v-list-item-title>Total Tokens: {{ testResult.usage.totalTokens }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </div>

                    <div class="mb-4">
                      <strong>Performance Metrics:</strong>
                      <v-list density="compact" class="mt-2">
                        <v-list-item class="px-0">
                          <v-list-item-title>Response Time: {{ testResult.responseTime }}ms</v-list-item-title>
                        </v-list-item>
                        <v-list-item class="px-0">
                          <v-list-item-title>Tokens per Second: {{ testResult.tokensPerSecond }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </div>

                    <div class="d-flex gap-2">
                      <v-btn
                        color="success"
                        prepend-icon="mdi-content-copy"
                        variant="outlined"
                        size="small"
                        @click="copyResult"
                      >
                        Copy Result
                      </v-btn>
                      <v-btn
                        color="info"
                        prepend-icon="mdi-download"
                        variant="outlined"
                        size="small"
                        @click="downloadResult"
                      >
                        Download
                      </v-btn>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Test History -->
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-history
              </v-icon>
              Test History
            </v-card-title>
            <v-card-text>
              <v-data-table
                :headers="historyHeaders"
                :items="testHistory"
                class="elevation-0"
                :items-per-page="5"
              >
                <template #item.input="{ item }">
                  <div class="text-truncate" style="max-width: 200px;">
                    {{ item.input }}
                  </div>
                </template>

                <template #item.output="{ item }">
                  <div class="text-truncate" style="max-width: 200px;">
                    {{ item.output }}
                  </div>
                </template>

                <template #item.responseTime="{ item }">
                  <span>{{ item.responseTime }}ms</span>
                </template>

                <template #item.timestamp="{ item }">
                  <span>{{ formatTime(item.timestamp) }}</span>
                </template>

                <template #item.actions="{ item }">
                  <div class="d-flex gap-1">
                    <v-btn
                      icon="mdi-eye"
                      size="small"
                      variant="text"
                      color="primary"
                      @click="() => viewHistoryItem(item)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      @click="() => deleteHistoryItem(item)"
                    />
                  </div>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <LLMGuide page="models" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutPageStructure from '~/components/layout/LayoutPageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const testing = ref(false)
const model = ref<any>(null)
const testResult = ref<any>(null)

// Test form data
const testInput = ref({
  prompt: '',
  maxTokens: 100,
  temperature: 0.7,
  topP: 1.0,
  frequencyPenalty: 0.0
})

// Test history
const testHistory = ref([
  {
    id: '1',
    input: 'Hello, how are you?',
    output: 'Hello! I\'m doing well, thank you for asking. How can I help you today?',
    responseTime: 245,
    tokensPerSecond: 12.3,
    timestamp: new Date(Date.now() - 5 * 60 * 1000)
  },
  {
    id: '2',
    input: 'What is machine learning?',
    output: 'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.',
    responseTime: 320,
    tokensPerSecond: 10.1,
    timestamp: new Date(Date.now() - 15 * 60 * 1000)
  }
])

// Table headers
const historyHeaders = [
  { title: 'Input', key: 'input', sortable: true },
  { title: 'Output', key: 'output', sortable: true },
  { title: 'Response Time', key: 'responseTime', sortable: true },
  { title: 'Timestamp', key: 'timestamp', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Mock model data
const mockModels = [
  {
    id: '1',
    name: 'GPT-4 Fine-tuned',
    description: 'Customer support model fine-tuned on support conversations',
    type: 'text-generation',
    status: 'ready',
    accuracy: 94,
    created_at: '2024-01-15',
    base_model: 'gpt-4'
  },
  {
    id: '2',
    name: 'BERT Classification',
    description: 'Text classification model for sentiment analysis',
    type: 'text-classification',
    status: 'ready',
    accuracy: 87,
    created_at: '2024-01-20',
    base_model: 'bert-base-uncased'
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'training': return 'warning'
    case 'deployed': return 'info'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const formatTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString()
}

const runTest = async () => {
  if (!testInput.value.prompt.trim()) {
    return
  }

  testing.value = true

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Mock test result
  testResult.value = {
    text: `This is a mock response to: "${testInput.value.prompt}". The model processed your input and generated this response based on its training data.`,
    usage: {
      promptTokens: testInput.value.prompt.split(' ').length,
      completionTokens: 25,
      totalTokens: testInput.value.prompt.split(' ').length + 25
    },
    responseTime: Math.floor(Math.random() * 500) + 200,
    tokensPerSecond: (Math.random() * 10 + 5).toFixed(1)
  }

  // Add to history
  testHistory.value.unshift({
    id: Date.now().toString(),
    input: testInput.value.prompt,
    output: testResult.value.text,
    responseTime: testResult.value.responseTime,
    tokensPerSecond: parseFloat(testResult.value.tokensPerSecond),
    timestamp: new Date()
  })

  testing.value = false
}

const resetForm = () => {
  testInput.value = {
    prompt: '',
    maxTokens: 100,
    temperature: 0.7,
    topP: 1.0,
    frequencyPenalty: 0.0
  }
  testResult.value = null
}

const copyResult = () => {
  if (testResult.value) {
    navigator.clipboard.writeText(testResult.value.text)
  }
}

const downloadResult = () => {
  if (testResult.value) {
    const data = {
      input: testInput.value.prompt,
      output: testResult.value.text,
      parameters: testInput.value,
      usage: testResult.value.usage,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-result-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

const viewHistoryItem = (item: any) => {
  testInput.value.prompt = item.input
  testResult.value = {
    text: item.output,
    usage: {
      promptTokens: item.input.split(' ').length,
      completionTokens: item.output.split(' ').length,
      totalTokens: item.input.split(' ').length + item.output.split(' ').length
    },
    responseTime: item.responseTime,
    tokensPerSecond: item.tokensPerSecond
  }
}

const deleteHistoryItem = (item: any) => {
  testHistory.value = testHistory.value.filter(h => h.id !== item.id)
}

onMounted(async () => {
  const modelId = route.params.id as string
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Find model in mock data
  model.value = mockModels.find(m => m.id === modelId) || null
  
  loading.value = false
})
</script>

<style scoped>
.gap-3 {
  gap: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-1 {
  gap: 0.25rem;
}

/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-textarea .v-field__input) {
  color: black !important;
}

:deep(.v-textarea .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-text-field .v-field__input) {
  color: black !important;
}

:deep(.v-text-field .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-btn) {
  color: black !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}
</style> 