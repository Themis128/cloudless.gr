<template>
  <div>
    <PageStructure
      :title="session?.name || 'Training Session Details'"
      :subtitle="session?.description || 'Monitor training progress and logs'"
      back-button-to="/llm/training"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">
            Loading training session details...
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

        <!-- Session Details -->
        <div v-else>
          <!-- Session Overview -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-school
              </v-icon>
              Training Session Overview
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Name:</strong> {{ session.name }}
                  </div>
                  <div class="mb-4">
                    <strong>Description:</strong> {{ session.description || 'No description available' }}
                  </div>
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ session.base_model }}
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
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Dataset Size:</strong> {{ session.dataset_size }}
                  </div>
                  <div class="mb-4">
                    <strong>Duration:</strong> {{ formatDuration(session.duration) }}
                  </div>
                  <div class="mb-4">
                    <strong>Created:</strong> {{ formatDate(session.created_at) }}
                  </div>
                  <div class="mb-4">
                    <strong>Session ID:</strong> {{ session.id }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Progress and Metrics -->
          <v-row class="mb-4">
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="primary" class="mb-2">
                    mdi-progress-clock
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ session.progress }}%
                  </div>
                  <div class="text-body-2">
                    Progress
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="info" class="mb-2">
                    mdi-clock-outline
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ session.epochs || 0 }}
                  </div>
                  <div class="text-body-2">
                    Epochs
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="warning" class="mb-2">
                    mdi-database
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ session.batch_size || 0 }}
                  </div>
                  <div class="text-body-2">
                    Batch Size
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="metric-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="success" class="mb-2">
                    mdi-chart-line
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ session.accuracy || 'N/A' }}
                  </div>
                  <div class="text-body-2">
                    Accuracy
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Progress Bar for Running Sessions -->
          <v-card v-if="session.status === 'running'" class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-progress-clock
              </v-icon>
              Training Progress
            </v-card-title>
            <v-card-text>
              <v-progress-linear
                :model-value="session.progress"
                color="primary"
                height="20"
                rounded
                class="mb-2"
              >
                <template #default="{ value }">
                  <strong>{{ Math.ceil(value) }}%</strong>
                </template>
              </v-progress-linear>
              <div class="d-flex justify-space-between text-caption">
                <span>Started: {{ formatDate(session.created_at) }}</span>
                <span>Estimated completion: {{ getEstimatedCompletion() }}</span>
              </div>
            </v-card-text>
          </v-card>

          <!-- Quick Actions -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-lightning-bolt
              </v-icon>
              Quick Actions
            </v-card-title>
            <v-card-text>
              <div class="d-flex gap-3 flex-wrap">
                <v-btn
                  v-if="session.status === 'running'"
                  color="error"
                  prepend-icon="mdi-stop"
                  variant="elevated"
                  size="large"
                  @click="stopTraining"
                >
                  Stop Training
                </v-btn>
                <v-btn
                  v-if="session.status === 'completed'"
                  color="success"
                  prepend-icon="mdi-download"
                  variant="elevated"
                  size="large"
                  @click="downloadModel"
                >
                  Download Model
                </v-btn>
                <v-btn
                  v-if="session.status === 'completed'"
                  color="info"
                  prepend-icon="mdi-rocket-launch"
                  variant="outlined"
                  size="large"
                  @click="deployModel"
                >
                  Deploy Model
                </v-btn>
                <v-btn
                  color="warning"
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="large"
                  @click="refreshSession"
                >
                  Refresh
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <!-- Training Configuration -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-cog
              </v-icon>
              Training Configuration
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Base Model:</strong> {{ session.base_model }}
                  </div>
                  <div class="mb-4">
                    <strong>Training Type:</strong> Fine-tuning
                  </div>
                  <div class="mb-4">
                    <strong>Epochs:</strong> {{ session.epochs || 'N/A' }}
                  </div>
                  <div class="mb-4">
                    <strong>Batch Size:</strong> {{ session.batch_size || 'N/A' }}
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Learning Rate:</strong> {{ session.learning_rate || 'N/A' }}
                  </div>
                  <div class="mb-4">
                    <strong>Optimizer:</strong> AdamW
                  </div>
                  <div class="mb-4">
                    <strong>Loss Function:</strong> Cross-Entropy
                  </div>
                  <div class="mb-4">
                    <strong>Validation Split:</strong> 20%
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Training Logs -->
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
              </v-tabs>

              <v-window v-model="activeTab" class="mt-4">
                <v-window-item value="logs">
                  <div class="training-logs">
                    <div
                      v-for="(log, index) in trainingLogs"
                      :key="index"
                      class="log-entry"
                      :class="log.level"
                    >
                      <span class="log-timestamp">{{ log.timestamp }}</span>
                      <span class="log-level">{{ log.level.toUpperCase() }}</span>
                      <span class="log-message">{{ log.message }}</span>
                    </div>
                  </div>
                </v-window-item>

                <v-window-item value="metrics">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p>Training metrics chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Loss, accuracy, and other metrics over time
                    </p>
                  </div>
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
                      </div>
                      <div class="error-message">
                        {{ error.message }}
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
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const session = ref<any>(null)
const activeTab = ref('logs')

// Mock training logs
const trainingLogs = ref([
  { timestamp: '2024-01-15 10:00:00', level: 'info', message: 'Training session started' },
  { timestamp: '2024-01-15 10:00:05', level: 'info', message: 'Loading dataset: 10K examples' },
  { timestamp: '2024-01-15 10:00:10', level: 'info', message: 'Initializing model: gpt-4' },
  { timestamp: '2024-01-15 10:00:15', level: 'info', message: 'Starting epoch 1/10' },
  { timestamp: '2024-01-15 10:05:00', level: 'info', message: 'Epoch 1 - Loss: 2.34, Accuracy: 0.45' },
  { timestamp: '2024-01-15 10:10:00', level: 'info', message: 'Epoch 2 - Loss: 1.89, Accuracy: 0.67' },
  { timestamp: '2024-01-15 10:15:00', level: 'info', message: 'Epoch 3 - Loss: 1.45, Accuracy: 0.78' },
  { timestamp: '2024-01-15 10:20:00', level: 'warning', message: 'Learning rate adjusted to 0.0001' },
  { timestamp: '2024-01-15 10:25:00', level: 'info', message: 'Epoch 4 - Loss: 1.12, Accuracy: 0.82' }
])

const errorLogs = ref([
  { timestamp: '2024-01-15 10:20:00', message: 'Learning rate adjustment required due to slow convergence' }
])

// Mock session data - in a real app, this would come from an API
const mockSessions = [
  {
    id: '1',
    name: 'GPT-4 Customer Support Training',
    description: 'Fine-tuning GPT-4 for customer support conversations',
    status: 'running',
    progress: 75,
    duration: 3600,
    created_at: '2024-01-15T10:00:00Z',
    base_model: 'gpt-4',
    dataset_size: '10K examples',
    epochs: 10,
    batch_size: 32,
    learning_rate: 0.0001,
    accuracy: 82
  },
  {
    id: '2',
    name: 'BERT Sentiment Analysis',
    description: 'Training BERT model for sentiment classification',
    status: 'completed',
    progress: 100,
    duration: 1800,
    created_at: '2024-01-14T14:30:00Z',
    base_model: 'bert-base-uncased',
    dataset_size: '5K examples',
    epochs: 5,
    batch_size: 16,
    learning_rate: 0.0002,
    accuracy: 87
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'info'
    case 'failed': return 'error'
    case 'queued': return 'warning'
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

const getEstimatedCompletion = () => {
  if (session.value?.status === 'running') {
    const elapsed = Date.now() - new Date(session.value.created_at).getTime()
    const progress = session.value.progress / 100
    const totalTime = elapsed / progress
    const remaining = totalTime - elapsed
    const completionTime = new Date(Date.now() + remaining)
    return completionTime.toLocaleTimeString()
  }
  return 'N/A'
}

const stopTraining = () => {
  // In a real app, this would stop the training session
      // Stopping training session
}

const downloadModel = () => {
  // In a real app, this would download the trained model
      // Downloading model from session
}

const deployModel = () => {
  // In a real app, this would deploy the model
  router.push(`/llm/deployments/create?model=${session.value?.id}`)
}

const refreshSession = () => {
  // In a real app, this would refresh the session data
      // Refreshing session data
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
.metric-card {
  transition: transform 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
}

.gap-3 {
  gap: 1rem;
}

.training-logs {
  max-height: 400px;
  overflow-y: auto;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

.log-entry {
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-timestamp {
  color: #666;
  margin-right: 1rem;
}

.log-level {
  font-weight: bold;
  margin-right: 1rem;
  min-width: 60px;
  display: inline-block;
}

.log-level.info {
  color: #2196f3;
}

.log-level.warning {
  color: #ff9800;
}

.log-level.error {
  color: #f44336;
}

.log-message {
  color: #333;
}

.error-logs {
  max-height: 400px;
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
</style> 