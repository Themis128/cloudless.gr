<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-progress-clock</v-icon>
      Training Progress
    </v-card-title>
    
    <v-card-text>
      <div v-if="!session">
        <v-alert type="info" variant="tonal">
          No active training session
        </v-alert>
      </div>
      
      <div v-else>
        <v-row class="mb-4">
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-h6 mb-2">Session Status</div>
                <v-chip 
                  :color="getStatusColor(session.status)" 
                  variant="flat"
                  class="mb-2"
                >
                  <v-icon start>{{ getStatusIcon(session.status) }}</v-icon>
                  {{ session.status.toUpperCase() }}
                </v-chip>
                <div class="text-body-2">
                  Started: {{ formatDate(session.created_at) }}
                </div>
                <div v-if="session.completed_at" class="text-body-2">
                  Completed: {{ formatDate(session.completed_at) }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-h6 mb-2">Training Progress</div>
                <v-progress-linear
                  :model-value="progress"
                  :color="progressColor"
                  height="20"
                  class="mb-2"
                >
                  <template #default="{ value }">
                    <strong>{{ Math.ceil(value) }}%</strong>
                  </template>
                </v-progress-linear>
                <div class="text-body-2">
                  Epoch {{ currentEpoch }} of {{ totalEpochs }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <v-row class="mb-4">
          <v-col cols="12" md="4">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-h6 mb-2">Loss</div>
                <div class="text-h4 text-primary">
                  {{ session.metrics?.loss?.toFixed(4) ?? 'N/A' }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Training Loss
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-h6 mb-2">Accuracy</div>
                <div class="text-h4 text-success">
                  {{ session.metrics?.accuracy ? (session.metrics.accuracy * 100).toFixed(2) + '%' : 'N/A' }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Training Accuracy
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-card variant="outlined">
              <v-card-text>
                <div class="text-h6 mb-2">Val Loss</div>
                <div class="text-h4 text-warning">
                  {{ session.metrics?.val_loss?.toFixed(4) ?? 'N/A' }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Validation Loss
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <v-row v-if="session.metrics?.history">
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title>Training Metrics Chart</v-card-title>
              <v-card-text>
                <div class="metrics-chart">
                  <!-- Placeholder for chart - you can integrate Chart.js or similar -->
                  <v-alert type="info" variant="tonal">
                    Chart visualization would go here (integrate Chart.js, D3, or Vuetify charts)
                  </v-alert>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <v-row v-if="session.log_url">
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title class="d-flex align-center">
                <v-icon class="me-2">mdi-text-box</v-icon>
                Training Logs
              </v-card-title>
              <v-card-text>
                <div class="log-container">
                  <pre class="logs">{{ logs }}</pre>
                </div>
                <v-btn 
                  variant="outlined" 
                  :href="session.log_url" 
                  target="_blank"
                  class="mt-2"
                >
                  <v-icon start>mdi-open-in-new</v-icon>
                  View Full Logs
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
    
    <v-card-actions v-if="session && session.status === 'running'">
      <v-spacer />
      <v-btn 
        color="error" 
        variant="outlined"
        :loading="stopping"
        @click="handleStop"
      >
        <v-icon start>mdi-stop</v-icon>
        Stop Training
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { TrainingSession } from '~/types/project'

const props = defineProps<{
  session: TrainingSession | null
  metrics?: any[]
  projectId: string
}>()

const emit = defineEmits<{
  stop: []
  refresh: []
}>()

const stopping = ref(false)
const logs = ref('Loading logs...')
const refreshInterval = ref<NodeJS.Timeout>()

const progress = computed(() => {
  if (!props.session?.metrics) return 0
  const current = props.session.metrics.epoch ?? 0
  const total = props.session.metrics.total_epochs ?? 100
  return (current / total) * 100
})

const currentEpoch = computed(() => {
  return props.session?.metrics?.epoch ?? 0
})

const totalEpochs = computed(() => {
  return props.session?.metrics?.total_epochs ?? 100
})

const progressColor = computed(() => {
  if (!props.session) return 'grey'
  
  switch (props.session.status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'running':
      return 'primary'
    default:
      return 'grey'
  }
})

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'running':
      return 'primary'
    case 'pending':
      return 'warning'
    default:
      return 'grey'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return 'mdi-check-circle'
    case 'failed':
      return 'mdi-alert-circle'
    case 'running':
      return 'mdi-play-circle'
    case 'pending':
      return 'mdi-clock-outline'
    default:
      return 'mdi-help-circle'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString()
}

async function handleStop() {
  stopping.value = true
  try {
    emit('stop')
  } finally {
    stopping.value = false
  }
}

async function fetchLogs() {
  if (props.session?.log_url) {
    try {
      // In a real app, you'd fetch the logs from the URL
      logs.value = `Training started at ${props.session.created_at}
Epoch 1/100 - loss: 0.6931, accuracy: 0.5000, val_loss: 0.6925, val_accuracy: 0.5100
Epoch 2/100 - loss: 0.6829, accuracy: 0.5200, val_loss: 0.6820, val_accuracy: 0.5250
Epoch 3/100 - loss: 0.6720, accuracy: 0.5400, val_loss: 0.6715, val_accuracy: 0.5400
...
Current status: ${props.session.status}`    } catch (error) {
      console.error('Failed to load logs:', error)
      logs.value = 'Failed to load logs'
    }
  }
}

onMounted(() => {
  fetchLogs()
  
  // Auto-refresh progress for running sessions
  if (props.session?.status === 'running') {
    refreshInterval.value = setInterval(() => {
      emit('refresh')
    }, 5000) // Refresh every 5 seconds
  }
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  background: linear-gradient(45deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 12px 12px 0 0;
}

.log-container {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.logs {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
}

.metrics-chart {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
