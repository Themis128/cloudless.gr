<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-compare</v-icon>
      Model Comparison
    </v-card-title>
    
    <v-card-text>
      <div v-if="!models || models.length === 0">
        <v-alert type="info" variant="tonal">
          No trained models available for comparison. Complete training sessions to see models here.
        </v-alert>
      </div>
      
      <div v-else>
        <v-row class="mb-4">
          <v-col cols="12" md="6">
            <v-select
              v-model="selectedMetric"
              :items="availableMetrics"
              label="Comparison Metric"
              variant="outlined"
              @update:model-value="updateChart"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="chartType"
              :items="chartTypes"
              label="Chart Type"
              variant="outlined"
              @update:model-value="updateChart"
            />
          </v-col>
        </v-row>
        
        <!-- Chart Container -->
        <v-row>
          <v-col cols="12">
            <v-card variant="outlined" class="chart-container">
              <v-card-text>
                <div ref="chartElement" class="chart-canvas">
                  <!-- Placeholder for chart -->
                  <div class="chart-placeholder">
                    <v-icon size="48" color="primary">mdi-chart-line</v-icon>
                    <div class="text-h6 mt-2">{{ selectedMetric }} Comparison</div>
                    <div class="text-body-2 text-medium-emphasis">
                      Chart visualization (integrate Chart.js, D3.js, or similar)
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <!-- Model Comparison Table -->
        <v-row class="mt-4">
          <v-col cols="12">
            <v-data-table
              :headers="tableHeaders"
              :items="models"
              :loading="loading"
              class="elevation-1"
              density="compact"
            >
              <template #item.model_name="{ item }">
                <div class="d-flex align-center">
                  <v-avatar :color="getModelColor(item.id)" size="24" class="me-2">
                    <span class="text-caption">{{ item.model_name.charAt(0).toUpperCase() }}</span>
                  </v-avatar>
                  {{ item.model_name }}
                </div>
              </template>
              
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
              
              <template #item.accuracy="{ item }">
                <div class="d-flex align-center">
                  <div class="me-2">{{ (item.metrics?.accuracy * 100)?.toFixed(2) ?? 'N/A' }}%</div>
                  <v-progress-linear
                    :model-value="(item.metrics?.accuracy ?? 0) * 100"
                    height="4"
                    color="success"
                    class="flex-grow-1"
                    style="max-width: 80px;"
                  />
                </div>
              </template>
              
              <template #item.loss="{ item }">
                <v-chip
                  :color="getLossColor(item.metrics?.loss ?? 0)"
                  size="small"
                  variant="flat"
                >
                  {{ item.metrics?.loss?.toFixed(4) ?? 'N/A' }}
                </v-chip>
              </template>
              
              <template #item.val_accuracy="{ item }">
                <div class="d-flex align-center">
                  <div class="me-2">{{ (item.metrics?.val_accuracy * 100)?.toFixed(2) ?? 'N/A' }}%</div>
                  <v-progress-linear
                    :model-value="(item.metrics?.val_accuracy ?? 0) * 100"
                    height="4"
                    color="info"
                    class="flex-grow-1"
                    style="max-width: 80px;"
                  />
                </div>
              </template>
              
              <template #item.val_loss="{ item }">
                <v-chip
                  :color="getLossColor(item.metrics?.val_loss ?? 0)"
                  size="small"
                  variant="flat"
                >
                  {{ item.metrics?.val_loss?.toFixed(4) ?? 'N/A' }}
                </v-chip>
              </template>
              
              <template #item.actions="{ item }">
                <v-btn
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  @click="viewModel(item)"
                >
                  <v-icon>mdi-eye</v-icon>
                  <v-tooltip activator="parent">View Details</v-tooltip>
                </v-btn>
                
                <v-btn
                  icon="mdi-download"
                  size="small"
                  variant="text"
                  @click="downloadModel(item)"
                >
                  <v-icon>mdi-download</v-icon>
                  <v-tooltip activator="parent">Download Model</v-tooltip>
                </v-btn>
                
                <v-btn
                  icon="mdi-rocket-launch"
                  size="small"
                  variant="text"
                  color="primary"
                  @click="deployModel(item)"
                >
                  <v-icon>mdi-rocket-launch</v-icon>
                  <v-tooltip activator="parent">Deploy Model</v-tooltip>
                </v-btn>
              </template>
            </v-data-table>
          </v-col>
        </v-row>
        
        <!-- Model Statistics -->
        <v-row class="mt-4">
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-primary">{{ models.length }}</div>
                <div class="text-body-2">Total Models</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-success">{{ bestAccuracy }}%</div>
                <div class="text-body-2">Best Accuracy</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-info">{{ lowestLoss }}</div>
                <div class="text-body-2">Lowest Loss</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-h4 text-warning">{{ avgTrainingTime }}</div>
                <div class="text-body-2">Avg Training Time</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

interface ModelMetrics {
  accuracy?: number
  loss?: number
  val_accuracy?: number
  val_loss?: number
}

interface Model {
  id: string
  model_name: string
  metrics: ModelMetrics
  created_at: string
  training_duration?: number
}

const props = defineProps<{
  models: Model[]
  metrics?: string[]
  loading?: boolean
}>()

const emit = defineEmits<{
  viewModel: [model: Model]
  downloadModel: [model: Model]
  deployModel: [model: Model]
}>()

const chartElement = ref<HTMLElement>()
const selectedMetric = ref('accuracy')
const chartType = ref('bar')

const availableMetrics = [
  { title: 'Accuracy', value: 'accuracy' },
  { title: 'Loss', value: 'loss' },
  { title: 'Validation Accuracy', value: 'val_accuracy' },
  { title: 'Validation Loss', value: 'val_loss' }
]

const chartTypes = [
  { title: 'Bar Chart', value: 'bar' },
  { title: 'Line Chart', value: 'line' },
  { title: 'Radar Chart', value: 'radar' }
]

const tableHeaders = [
  { title: 'Model', key: 'model_name', sortable: true },
  { title: 'Accuracy', key: 'accuracy', align: 'center' },
  { title: 'Loss', key: 'loss', align: 'center' },
  { title: 'Val Accuracy', key: 'val_accuracy', align: 'center' },
  { title: 'Val Loss', key: 'val_loss', align: 'center' },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
]

const bestAccuracy = computed(() => {
  if (!props.models.length) return 'N/A'
  const best = Math.max(...props.models.map(m => m.metrics?.accuracy ?? 0))
  return (best * 100).toFixed(1)
})

const lowestLoss = computed(() => {
  if (!props.models.length) return 'N/A'
  const lowest = Math.min(...props.models.map(m => m.metrics?.loss ?? Infinity))
  return lowest !== Infinity ? lowest.toFixed(4) : 'N/A'
})

const avgTrainingTime = computed(() => {
  if (!props.models.length) return 'N/A'
  const times = props.models.filter(m => m.training_duration).map(m => m.training_duration!)
  if (!times.length) return 'N/A'
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  return formatDuration(avg)
})

function getModelColor(modelId: string) {
  const colors = ['primary', 'secondary', 'success', 'info', 'warning', 'error']
  const index = modelId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[index % colors.length]
}

function getLossColor(loss: number) {
  if (loss < 0.1) return 'success'
  if (loss < 0.3) return 'warning'
  return 'error'
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString()
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return `${seconds}s`
  }
}

function updateChart() {
  nextTick(() => {
    // In a real implementation, you would update the chart here
    // using Chart.js, D3.js, or another charting library
    console.log(`Updating chart: ${chartType.value} chart for ${selectedMetric.value}`)
  })
}

function viewModel(model: Model) {
  emit('viewModel', model)
}

function downloadModel(model: Model) {
  emit('downloadModel', model)
}

function deployModel(model: Model) {
  emit('deployModel', model)
}

onMounted(() => {
  updateChart()
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

.chart-container {
  min-height: 400px;
}

.chart-canvas {
  height: 350px;
  position: relative;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
}

.v-data-table {
  border-radius: 8px;
}
</style>
