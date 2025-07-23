<template>
  <div class="redis-analytics">
    <!-- Health Status Banner -->
    <v-alert
      v-if="analytics?.health"
      :type="getHealthAlertType(analytics.health.status)"
      variant="tonal"
      class="mb-4"
    >
      <template #title>
        <strong>Redis Health Status: {{ analytics.health.status.toUpperCase() }}</strong>
      </template>
      <div v-if="analytics.health.issues.length > 0">
        <p class="mb-2"><strong>Issues:</strong></p>
        <ul class="mb-2">
          <li v-for="issue in analytics.health.issues" :key="issue">{{ issue }}</li>
        </ul>
        <p class="mb-0"><strong>Recommendations:</strong></p>
        <ul class="mb-0">
          <li v-for="rec in analytics.health.recommendations" :key="rec">{{ rec }}</li>
        </ul>
      </div>
      <div v-else>
        Redis is running optimally with no issues detected.
      </div>
    </v-alert>

    <!-- Overview Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="bg-white">
          <v-card-text class="text-center">
            <v-icon size="48" color="primary" class="mb-2">
              mdi-memory
            </v-icon>
            <div class="text-h6 font-weight-bold">
              {{ analytics?.memory?.memoryUsagePercent || 0 }}%
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Memory Usage
            </div>
            <div class="text-caption">
              {{ analytics?.memory?.usedMemoryHuman || '0B' }} / {{ analytics?.memory?.maxMemoryHuman || '0B' }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="bg-white">
          <v-card-text class="text-center">
            <v-icon size="48" color="success" class="mb-2">
              mdi-chart-line
            </v-icon>
            <div class="text-h6 font-weight-bold">
              {{ analytics?.performance?.hitRate || 0 }}%
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Cache Hit Rate
            </div>
            <div class="text-caption">
              {{ analytics?.performance?.keyspaceHits || 0 }} hits / {{ analytics?.performance?.keyspaceMisses || 0 }} misses
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="bg-white">
          <v-card-text class="text-center">
            <v-icon size="48" color="info" class="mb-2">
              mdi-key
            </v-icon>
            <div class="text-h6 font-weight-bold">
              {{ analytics?.keys?.totalKeys || 0 }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Total Keys
            </div>
            <div class="text-caption">
              {{ analytics?.overview?.connectedClients || 0 }} clients connected
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="bg-white">
          <v-card-text class="text-center">
            <v-icon size="48" color="warning" class="mb-2">
              mdi-speedometer
            </v-icon>
            <div class="text-h6 font-weight-bold">
              {{ analytics?.performance?.opsPerSec || 0 }}
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Ops/Second
            </div>
            <div class="text-caption">
              {{ analytics?.performance?.totalConnections || 0 }} total connections
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Detailed Metrics -->
    <v-row>
      <!-- Performance Chart -->
      <v-col cols="12" md="6">
        <v-card class="bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-chart-line
            </v-icon>
            Performance Metrics
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>Operations per Second</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.performance?.opsPerSec || 0 }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Total Connections</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.performance?.totalConnections || 0 }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Rejected Connections</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.performance?.rejectedConnections || 0 }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Network Input</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.performance?.totalNetInput || '0B' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Network Output</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.performance?.totalNetOutput || '0B' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Memory Details -->
      <v-col cols="12" md="6">
        <v-card class="bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-memory
            </v-icon>
            Memory Details
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>Used Memory</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.memory?.usedMemoryHuman || '0B' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Peak Memory</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.memory?.usedMemoryPeakHuman || '0B' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Max Memory</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.memory?.maxMemoryHuman || '0B' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Fragmentation Ratio</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.memory?.fragmentationRatio || 0 }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Eviction Policy</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.memoryPolicy || 'none' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Key Patterns -->
    <v-card class="bg-white mt-6">
      <v-card-title>
        <v-icon start color="primary">
          mdi-key-variant
        </v-icon>
        Key Patterns Distribution
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col
            v-for="(count, pattern) in analytics?.keys?.keyPatterns"
            :key="pattern"
            cols="6"
            sm="4"
            md="3"
          >
            <v-card variant="outlined" class="text-center">
              <v-card-text>
                <div class="text-h6 font-weight-bold text-primary">
                  {{ count }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ formatKeyPattern(pattern) }}
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Largest Keys -->
    <v-card v-if="analytics?.keys?.largestKeys?.length" class="bg-white mt-6">
      <v-card-title>
        <v-icon start color="primary">
          mdi-database
        </v-icon>
        Largest Keys
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="largestKeysHeaders"
          :items="analytics.keys.largestKeys"
          :items-per-page="5"
          class="elevation-0"
        >
          <template #item.key="{ item }">
            <code class="text-caption">{{ item.key }}</code>
          </template>
          <template #item.size="{ item }">
            <v-chip :color="getSizeColor(item.size)" size="small">
              {{ item.size }}
            </v-chip>
          </template>
          <template #item.type="{ item }">
            <v-chip :color="getTypeColor(item.type)" size="small">
              {{ item.type }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Slow Queries -->
    <v-card v-if="analytics?.slowQueries?.length" class="bg-white mt-6">
      <v-card-title>
        <v-icon start color="warning">
          mdi-clock-alert
        </v-icon>
        Slow Queries (Last 10)
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="slowQueriesHeaders"
          :items="analytics.slowQueries"
          :items-per-page="5"
          class="elevation-0"
        >
          <template #item.timestamp="{ item }">
            {{ formatTimestamp(item.timestamp) }}
          </template>
          <template #item.duration="{ item }">
            <v-chip :color="getDurationColor(item.duration)" size="small">
              {{ item.duration }}ms
            </v-chip>
          </template>
          <template #item.command="{ item }">
            <code class="text-caption">{{ item.command }}</code>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- System Info -->
    <v-card class="bg-white mt-6">
      <v-card-title>
        <v-icon start color="primary">
          mdi-information
        </v-icon>
        System Information
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-list>
              <v-list-item>
                <v-list-item-title>Redis Version</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.version || 'Unknown' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Uptime</v-list-item-title>
                <v-list-item-subtitle>{{ formatUptime(analytics?.overview?.uptime) }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Connected Clients</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.connectedClients || 0 }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-col>
          <v-col cols="12" md="6">
            <v-list>
              <v-list-item>
                <v-list-item-title>Total Commands</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.totalCommands || 0 }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Memory Usage</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.memoryUsage || '0B' }}</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Memory Peak</v-list-item-title>
                <v-list-item-subtitle>{{ analytics?.overview?.memoryPeak || '0B' }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Loading State -->
    <v-card v-if="loading" class="bg-white mt-6">
      <v-card-text class="text-center py-8">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <h3 class="mt-4">Loading Redis Analytics...</h3>
      </v-card-text>
    </v-card>

    <!-- Error State -->
    <v-card v-if="error" class="bg-white mt-6">
      <v-card-text class="text-center py-8">
        <v-icon size="64" color="error" class="mb-4">
          mdi-alert-circle
        </v-icon>
        <h3>Error Loading Redis Analytics</h3>
        <p class="text-medium-emphasis">{{ error }}</p>
        <v-btn color="primary" @click="fetchAnalytics" class="mt-4">
          <v-icon start>mdi-refresh</v-icon>
          Retry
        </v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface RedisAnalytics {
  overview: {
    version: string
    uptime: string
    connectedClients: number
    totalCommands: number
    memoryUsage: string
    memoryPeak: string
    maxMemory: string
    memoryPolicy: string
  }
  performance: {
    opsPerSec: number
    totalConnections: number
    rejectedConnections: number
    totalNetInput: string
    totalNetOutput: string
    keyspaceHits: number
    keyspaceMisses: number
    hitRate: number
  }
  memory: {
    usedMemory: number
    usedMemoryHuman: string
    usedMemoryPeak: number
    usedMemoryPeakHuman: string
    maxMemory: number
    maxMemoryHuman: string
    memoryUsagePercent: number
    fragmentationRatio: number
  }
  keys: {
    totalKeys: number
    keyPatterns: Record<string, number>
    largestKeys: Array<{
      key: string
      size: number
      type: string
    }>
  }
  slowQueries: Array<{
    id: number
    timestamp: number
    duration: number
    command: string
    args: string[]
  }>
  health: {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  }
}

const analytics = ref<RedisAnalytics | null>(null)
const loading = ref(true)
const error = ref('')
let refreshInterval: NodeJS.Timeout | null = null

// Table headers
const largestKeysHeaders = [
  { title: 'Key', key: 'key', sortable: false },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
]

const slowQueriesHeaders = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Timestamp', key: 'timestamp', sortable: true },
  { title: 'Duration', key: 'duration', sortable: true },
  { title: 'Command', key: 'command', sortable: false },
]

// Fetch analytics data
const fetchAnalytics = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const response = await $fetch<RedisAnalytics>('/api/admin/redis-analytics')
    analytics.value = response
  } catch (err: any) {
    console.error('Error fetching Redis analytics:', err)
    error.value = err.message || 'Failed to load Redis analytics'
  } finally {
    loading.value = false
  }
}

// Utility functions
const getHealthAlertType = (status: string) => {
  switch (status) {
    case 'healthy': return 'success'
    case 'warning': return 'warning'
    case 'critical': return 'error'
    default: return 'info'
  }
}

const formatKeyPattern = (pattern: string) => {
  return pattern.replace('*', '') + ' Keys'
}

const getSizeColor = (size: number) => {
  if (size > 1000) return 'error'
  if (size > 100) return 'warning'
  return 'success'
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    string: 'primary',
    list: 'success',
    set: 'info',
    hash: 'warning',
    zset: 'error',
  }
  return colors[type] || 'grey'
}

const getDurationColor = (duration: number) => {
  if (duration > 1000) return 'error'
  if (duration > 100) return 'warning'
  return 'success'
}

const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString()
}

const formatUptime = (uptime: string) => {
  const seconds = parseInt(uptime || '0')
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Auto-refresh every 30 seconds
const startAutoRefresh = () => {
  refreshInterval = setInterval(fetchAnalytics, 30000)
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

// Lifecycle
onMounted(() => {
  fetchAnalytics()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

// Expose methods to parent component
defineExpose({
  fetchAnalytics
})
</script>

<style scoped>
.redis-analytics {
  max-width: 100%;
}

.v-card {
  border-radius: 12px;
}

.v-data-table {
  border-radius: 8px;
}

code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
</style> 