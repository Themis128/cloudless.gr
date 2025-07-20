<template>
  <div>
    <PageStructure
      :title="`Training Logs - ${session?.name || 'Session'}`"
      subtitle="Detailed logs and metrics for training session"
      back-button-to="/llm/training"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">
            Loading training logs...
          </p>
        </div>

        <!-- Session Not Found -->
        <div v-else-if="!session" class="text-center py-8">
          <v-icon size="64" color="error" class="mb-4">
            mdi-alert-circle
          </v-icon>
          <h2 class="text-h5 mb-2">
            Training Session Not Found
          </h2>
          <p class="text-body-1 mb-4">
            The training session you're looking for doesn't exist or has been removed.
          </p>
          <v-btn color="primary" to="/llm/training">
            Back to Training Sessions
          </v-btn>
        </div>

        <!-- Training Logs -->
        <div v-else>
          <!-- Session Overview -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-school
              </v-icon>
              Session Overview
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Name:</strong> {{ session.name }}
                  </div>
                  <div class="mb-4">
                    <strong>Status:</strong>
                    <v-chip
                      :color="getStatusColor(session.status)"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ session.status }}
                    </v-chip>
                  </div>
                  <div class="mb-4">
                    <strong>Progress:</strong> {{ session.progress }}%
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ session.base_model }}
                  </div>
                  <div class="mb-4">
                    <strong>Duration:</strong> {{ formatDuration(session.duration) }}
                  </div>
                  <div class="mb-4">
                    <strong>Started:</strong> {{ formatDate(session.created_at) }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Log Filters -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-filter
              </v-icon>
              Log Filters
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="logLevelFilter"
                    :items="logLevels"
                    label="Log Level"
                    variant="outlined"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="searchQuery"
                    label="Search Logs"
                    variant="outlined"
                    prepend-icon="mdi-magnify"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <div class="d-flex gap-2">
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-refresh"
                      variant="outlined"
                      @click="refreshLogs"
                    >
                      Refresh
                    </v-btn>
                    <v-btn
                      color="success"
                      prepend-icon="mdi-download"
                      variant="outlined"
                      @click="downloadLogs"
                    >
                      Download
                    </v-btn>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Logs Tabs -->
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-text-box-outline
              </v-icon>
              Training Logs
            </v-card-title>
            <v-card-text>
              <v-tabs v-model="activeTab" color="primary">
                <v-tab value="logs">
                  <v-icon start>
                    mdi-text-box-outline
                  </v-icon>
                  Logs
                </v-tab>
                <v-tab value="metrics">
                  <v-icon start>
                    mdi-chart-line
                  </v-icon>
                  Metrics
                </v-tab>
                <v-tab value="errors">
                  <v-icon start>
                    mdi-alert-circle
                  </v-icon>
                  Errors
                </v-tab>
                <v-tab value="system">
                  <v-icon start>
                    mdi-cog
                  </v-icon>
                  System
                </v-tab>
              </v-tabs>

              <v-window v-model="activeTab" class="mt-4">
                <v-window-item value="logs">
                  <div class="training-logs">
                    <div
                      v-for="(log, index) in filteredLogs"
                      :key="index"
                      class="log-entry"
                      :class="log.level"
                    >
                      <div class="log-header">
                        <span class="log-timestamp">{{ log.timestamp }}</span>
                        <v-chip
                          :color="getLogLevelColor(log.level)"
                          size="x-small"
                          variant="tonal"
                          class="log-level-chip"
                        >
                          {{ log.level.toUpperCase() }}
                        </v-chip>
                      </div>
                      <div class="log-message">
                        {{ log.message }}
                      </div>
                      <div v-if="log.details" class="log-details">
                        <pre>{{ log.details }}</pre>
                      </div>
                    </div>
                  </div>
                </v-window-item>

                <v-window-item value="metrics">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined">
                        <v-card-title class="text-h6">
                          Training Metrics
                        </v-card-title>
                        <v-card-text>
                          <div class="mb-4">
                            <strong>Loss:</strong>
                            <v-progress-linear
                              :model-value="(1 - trainingMetrics.loss / 5) * 100"
                              color="primary"
                              height="8"
                              rounded
                              class="mt-1"
                            />
                            <span class="text-caption">{{ trainingMetrics.loss.toFixed(4) }}</span>
                          </div>
                          <div class="mb-4">
                            <strong>Accuracy:</strong>
                            <v-progress-linear
                              :model-value="trainingMetrics.accuracy"
                              color="success"
                              height="8"
                              rounded
                              class="mt-1"
                            />
                            <span class="text-caption">{{ trainingMetrics.accuracy.toFixed(2) }}%</span>
                          </div>
                          <div class="mb-4">
                            <strong>Learning Rate:</strong>
                            <span class="text-caption">{{ trainingMetrics.learningRate }}</span>
                          </div>
                          <div class="mb-4">
                            <strong>Epoch:</strong>
                            <span class="text-caption">{{ trainingMetrics.epoch }}/{{ trainingMetrics.totalEpochs }}</span>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined">
                        <v-card-title class="text-h6">
                          System Metrics
                        </v-card-title>
                        <v-card-text>
                          <div class="mb-4">
                            <strong>GPU Usage:</strong>
                            <v-progress-linear
                              :model-value="systemMetrics.gpuUsage"
                              color="warning"
                              height="8"
                              rounded
                              class="mt-1"
                            />
                            <span class="text-caption">{{ systemMetrics.gpuUsage }}%</span>
                          </div>
                          <div class="mb-4">
                            <strong>Memory Usage:</strong>
                            <v-progress-linear
                              :model-value="systemMetrics.memoryUsage"
                              color="info"
                              height="8"
                              rounded
                              class="mt-1"
                            />
                            <span class="text-caption">{{ systemMetrics.memoryUsage }}%</span>
                          </div>
                          <div class="mb-4">
                            <strong>CPU Usage:</strong>
                            <span class="text-caption">{{ systemMetrics.cpuUsage }}%</span>
                          </div>
                          <div class="mb-4">
                            <strong>Temperature:</strong>
                            <span class="text-caption">{{ systemMetrics.temperature }}°C</span>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-col>
                  </v-row>
                </v-window-item>

                <v-window-item value="errors">
                  <div v-if="errorLogs.length > 0" class="error-logs">
                    <div
                      v-for="(error, index) in errorLogs"
                      :key="index"
                      class="error-entry"
                    >
                      <div class="error-header">
                        <v-icon color="error" size="small" class="mr-2">
                          mdi-alert-circle
                        </v-icon>
                        <span class="error-timestamp">{{ error.timestamp }}</span>
                        <v-chip
                          color="error"
                          size="x-small"
                          variant="tonal"
                          class="ml-2"
                        >
                          {{ error.type }}
                        </v-chip>
                      </div>
                      <div class="error-message">
                        {{ error.message }}
                      </div>
                      <div v-if="error.stack" class="error-stack">
                        <details>
                          <summary>Stack Trace</summary>
                          <pre>{{ error.stack }}</pre>
                        </details>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-8">
                    <v-icon size="64" color="success" class="mb-4">
                      mdi-check-circle
                    </v-icon>
                    <p>No errors found</p>
                    <p class="text-caption text-medium-emphasis">
                      Training is proceeding without issues
                    </p>
                  </div>
                </v-window-item>

                <v-window-item value="system">
                  <v-card variant="outlined">
                    <v-card-title class="text-h6">
                      System Information
                    </v-card-title>
                    <v-card-text>
                      <v-row>
                        <v-col cols="12" md="6">
                          <div class="mb-4">
                            <strong>Platform:</strong> {{ systemInfo.platform }}
                          </div>
                          <div class="mb-4">
                            <strong>Python Version:</strong> {{ systemInfo.pythonVersion }}
                          </div>
                          <div class="mb-4">
                            <strong>CUDA Version:</strong> {{ systemInfo.cudaVersion }}
                          </div>
                          <div class="mb-4">
                            <strong>GPU Model:</strong> {{ systemInfo.gpuModel }}
                          </div>
                        </v-col>
                        <v-col cols="12" md="6">
                          <div class="mb-4">
                            <strong>Framework:</strong> {{ systemInfo.framework }}
                          </div>
                          <div class="mb-4">
                            <strong>Framework Version:</strong> {{ systemInfo.frameworkVersion }}
                          </div>
                          <div class="mb-4">
                            <strong>Memory:</strong> {{ systemInfo.memory }}
                          </div>
                          <div class="mb-4">
                            <strong>Storage:</strong> {{ systemInfo.storage }}
                          </div>
                        </v-col>
                      </v-row>
                    </v-card-text>
                  </v-card>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <LLMGuide page="training" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const route = useRoute()
const loading = ref(true)
const session = ref<any>(null)
const activeTab = ref('logs')
const logLevelFilter = ref('')
const searchQuery = ref('')

// Mock training logs
const trainingLogs = ref([
  { timestamp: '2024-01-15 10:00:00', level: 'info', message: 'Training session started', details: null },
  { timestamp: '2024-01-15 10:00:05', level: 'info', message: 'Loading dataset: 10K examples', details: null },
  { timestamp: '2024-01-15 10:00:10', level: 'info', message: 'Initializing model: gpt-4', details: null },
  { timestamp: '2024-01-15 10:00:15', level: 'info', message: 'Starting epoch 1/10', details: null },
  { timestamp: '2024-01-15 10:05:00', level: 'info', message: 'Epoch 1 - Loss: 2.34, Accuracy: 0.45', details: 'Training metrics updated' },
  { timestamp: '2024-01-15 10:10:00', level: 'info', message: 'Epoch 2 - Loss: 1.89, Accuracy: 0.67', details: 'Training metrics updated' },
  { timestamp: '2024-01-15 10:15:00', level: 'info', message: 'Epoch 3 - Loss: 1.45, Accuracy: 0.78', details: 'Training metrics updated' },
  { timestamp: '2024-01-15 10:20:00', level: 'warning', message: 'Learning rate adjusted to 0.0001', details: 'Slow convergence detected' },
  { timestamp: '2024-01-15 10:25:00', level: 'info', message: 'Epoch 4 - Loss: 1.12, Accuracy: 0.82', details: 'Training metrics updated' },
  { timestamp: '2024-01-15 10:30:00', level: 'error', message: 'GPU memory allocation failed', details: 'Out of memory error on GPU 0' }
])

const errorLogs = ref([
  { 
    timestamp: '2024-01-15 10:30:00', 
    type: 'GPU_ERROR',
    message: 'GPU memory allocation failed',
    stack: 'Traceback (most recent call last):\n  File "train.py", line 45, in <module>\n    model = Model()\nOutOfMemoryError: CUDA out of memory'
  }
])

const trainingMetrics = ref({
  loss: 1.12,
  accuracy: 82.5,
  learningRate: 0.0001,
  epoch: 4,
  totalEpochs: 10
})

const systemMetrics = ref({
  gpuUsage: 85,
  memoryUsage: 72,
  cpuUsage: 45,
  temperature: 78
})

const systemInfo = ref({
  platform: 'Linux x86_64',
  pythonVersion: '3.9.7',
  cudaVersion: '11.8',
  gpuModel: 'NVIDIA RTX 4090',
  framework: 'PyTorch',
  frameworkVersion: '2.0.1',
  memory: '32GB RAM',
  storage: '1TB SSD'
})

const logLevels = [
  { title: 'Info', value: 'info' },
  { title: 'Warning', value: 'warning' },
  { title: 'Error', value: 'error' },
  { title: 'Debug', value: 'debug' }
]

// Mock session data
const mockSessions = [
  {
    id: '1',
    name: 'GPT-4 Customer Support Training',
    description: 'Fine-tuning GPT-4 for customer support conversations',
    status: 'running',
    progress: 75,
    duration: 3600,
    created_at: '2024-01-15T10:00:00Z',
    base_model: 'gpt-4'
  }
]

const filteredLogs = computed(() => {
  let filtered = trainingLogs.value

  if (logLevelFilter.value) {
    filtered = filtered.filter(log => log.level === logLevelFilter.value)
  }

  if (searchQuery.value) {
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.value.toLowerCase()))
    )
  }

  return filtered
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'info'
    case 'failed': return 'error'
    case 'queued': return 'warning'
    default: return 'grey'
  }
}

const getLogLevelColor = (level: string) => {
  switch (level) {
    case 'info': return 'info'
    case 'warning': return 'warning'
    case 'error': return 'error'
    case 'debug': return 'grey'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const refreshLogs = () => {
  // In a real app, this would refresh the logs from the API
  console.log('Refreshing logs...')
}

const downloadLogs = () => {
  // In a real app, this would download the logs
  const logData = {
    session: session.value,
    logs: trainingLogs.value,
    errors: errorLogs.value,
    metrics: trainingMetrics.value,
    system: systemInfo.value
  }
  
  const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `training-logs-${session.value?.id}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  const sessionId = route.params.id as string
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Find session in mock data
  session.value = mockSessions.find(s => s.id === sessionId) || null
  
  loading.value = false
})
</script>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}

.training-logs {
  max-height: 600px;
  overflow-y: auto;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

.log-entry {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 8px;
  background: white;
  border-left: 4px solid #e0e0e0;
}

.log-entry.info {
  border-left-color: #2196f3;
}

.log-entry.warning {
  border-left-color: #ff9800;
}

.log-entry.error {
  border-left-color: #f44336;
}

.log-entry.debug {
  border-left-color: #9e9e9e;
}

.log-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.log-timestamp {
  color: #666;
  font-size: 0.75rem;
  margin-right: 1rem;
}

.log-level-chip {
  font-size: 0.625rem;
}

.log-message {
  color: #333;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.log-details {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #666;
}

.log-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.error-logs {
  max-height: 600px;
  overflow-y: auto;
}

.error-entry {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.error-header {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.error-timestamp {
  color: #666;
  font-size: 0.875rem;
}

.error-message {
  color: #d32f2f;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.error-stack {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.75rem;
}

.error-stack summary {
  cursor: pointer;
  color: #666;
  margin-bottom: 0.5rem;
}

.error-stack pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #333;
}

/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-tab) {
  color: black !important;
}

:deep(.v-tab--selected) {
  color: black !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-btn) {
  color: black !important;
}

:deep(.v-select .v-field__input) {
  color: black !important;
}

:deep(.v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-text-field .v-field__input) {
  color: black !important;
}

:deep(.v-text-field .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}
</style> 