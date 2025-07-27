<template>
  <div class="pipeline-analytics">
    <v-container>
      <!-- Header -->
      <v-row class="mb-8">
        <v-col cols="12">
          <h1 class="text-h3 font-weight-bold mb-2">Pipeline Analytics</h1>
          <p class="text-body-1 text-medium-emphasis">Monitor and analyze your pipeline performance</p>
        </v-col>
      </v-row>

      <!-- Analytics Overview Cards -->
      <v-row class="mb-8">
        <v-col cols="12" md="6" lg="3">
          <v-card class="pa-6">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="48" class="mr-4">
                <v-icon color="white">mdi-chart-bar</v-icon>
              </v-avatar>
              <div>
                <p class="text-caption text-medium-emphasis">Total Pipelines</p>
                <p class="text-h4 font-weight-bold">{{ analytics.totalPipelines }}</p>
              </div>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="pa-6">
            <div class="d-flex align-center">
              <v-avatar color="success" size="48" class="mr-4">
                <v-icon color="white">mdi-check-circle</v-icon>
              </v-avatar>
              <div>
                <p class="text-caption text-medium-emphasis">Active Pipelines</p>
                <p class="text-h4 font-weight-bold">{{ analytics.activePipelines }}</p>
              </div>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="pa-6">
            <div class="d-flex align-center">
              <v-avatar color="warning" size="48" class="mr-4">
                <v-icon color="white">mdi-lightning-bolt</v-icon>
              </v-avatar>
              <div>
                <p class="text-caption text-medium-emphasis">Avg Execution Time</p>
                <p class="text-h4 font-weight-bold">{{ analytics.avgExecutionTime }}s</p>
              </div>
            </div>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" lg="3">
          <v-card class="pa-6">
            <div class="d-flex align-center">
              <v-avatar color="info" size="48" class="mr-4">
                <v-icon color="white">mdi-percent</v-icon>
              </v-avatar>
              <div>
                <p class="text-caption text-medium-emphasis">Success Rate</p>
                <p class="text-h4 font-weight-bold">{{ analytics.successRate }}%</p>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Section -->
      <v-row class="mb-8">
        <!-- Execution Time Chart -->
        <v-col cols="12" lg="6">
          <v-card class="pa-6">
            <h3 class="text-h5 font-weight-bold mb-4">Execution Time Trends</h3>
            <div class="d-flex align-center justify-center" style="height: 256px;">
              <p class="text-medium-emphasis">Chart placeholder - Execution time over time</p>
            </div>
          </v-card>
        </v-col>

        <!-- Success Rate Chart -->
        <v-col cols="12" lg="6">
          <v-card class="pa-6">
            <h3 class="text-h5 font-weight-bold mb-4">Success Rate by Pipeline Type</h3>
            <div class="d-flex align-center justify-center" style="height: 256px;">
              <p class="text-medium-emphasis">Chart placeholder - Success rate breakdown</p>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent Executions Table -->
      <v-card>
        <v-card-title class="text-h5 font-weight-bold">
          Recent Executions
        </v-card-title>
        <v-data-table
          :headers="tableHeaders"
          :items="recentExecutions"
          :items-per-page="10"
          class="elevation-1"
        >
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="getStatusColor(item.status)"
              size="small"
              :text="item.status"
            />
          </template>
          <template v-slot:item.duration="{ item }">
            {{ item.duration }}s
          </template>
          <template v-slot:item.started="{ item }">
            {{ formatDate(item.started) }}
          </template>
        </v-data-table>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Types
interface Analytics {
  totalPipelines: number
  activePipelines: number
  avgExecutionTime: number
  successRate: number
}

interface Execution {
  id: string
  pipeline: string
  status: 'success' | 'failed' | 'running' | 'pending'
  duration: number
  started: string
}

// Reactive state
const analytics = ref<Analytics>({
  totalPipelines: 24,
  activePipelines: 8,
  avgExecutionTime: 45,
  successRate: 94
})

const recentExecutions = ref<Execution[]>([
  {
    id: '1',
    pipeline: 'Data Processing Pipeline',
    status: 'success',
    duration: 120,
    started: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    pipeline: 'ML Training Pipeline',
    status: 'running',
    duration: 300,
    started: '2024-01-15T09:15:00Z'
  },
  {
    id: '3',
    pipeline: 'ETL Pipeline',
    status: 'failed',
    duration: 45,
    started: '2024-01-15T08:45:00Z'
  },
  {
    id: '4',
    pipeline: 'Analytics Pipeline',
    status: 'success',
    duration: 180,
    started: '2024-01-15T07:30:00Z'
  }
])

const tableHeaders = [
  { title: 'Pipeline', key: 'pipeline' },
  { title: 'Status', key: 'status' },
  { title: 'Duration', key: 'duration' },
  { title: 'Started', key: 'started' }
]

// Methods
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'error'
    case 'running':
      return 'warning'
    case 'pending':
      return 'info'
    default:
      return 'primary'
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

// Lifecycle
onMounted(() => {
  // Load analytics data
  console.log('Loading pipeline analytics...')
})

// Meta
definePageMeta({
  title: 'Pipeline Analytics',
  description: 'Monitor and analyze your pipeline performance',
  layout: 'default'
})
</script>

<style scoped>
.pipeline-analytics {
  max-width: 1200px;
  margin: 0 auto;
}

/* Responsive improvements */
@media (max-width: 600px) {
  .pipeline-analytics {
    padding: 0 16px;
  }
}
</style> 