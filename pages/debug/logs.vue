<template>
  <div>
    <v-container>
      <!-- Back to Debug Button -->
      <div class="mb-4">
        <v-btn
          color="secondary"
          variant="outlined"
          prepend-icon="mdi-arrow-left"
          @click="goBackToDebug"
        >
          Back to Debug
        </v-btn>
      </div>
      
      <h1 class="mb-4">
        Logs Debug
      </h1>
      <v-form @submit.prevent="manageLogs">
        <v-text-field
          v-model="form.logLevel"
          label="Log Level"
          class="mb-3"
          required
        />
        <v-textarea
          v-model="form.message"
          label="Log Message"
          class="mb-3"
          rows="3"
          required
        />
        <v-select
          v-model="form.source"
          :items="logSources"
          label="Log Source"
          class="mb-3"
          required
        />
        <v-text-field
          v-model="form.maxLogs"
          label="Max Logs to Display"
          type="number"
          min="1"
          max="1000"
          class="mb-3"
          required
        />
        <v-btn type="submit" color="primary" :loading="loading">
          Add Log Entry
        </v-btn>
        <v-btn text class="ml-2" @click="resetForm">
          Reset
        </v-btn>
        <v-btn
          color="secondary"
          text
          class="ml-2"
          @click="clearLogs"
        >
          Clear Logs
        </v-btn>
        <v-btn
          color="warning"
          text
          class="ml-2"
          @click="exportLogs"
        >
          Export Logs
        </v-btn>
      </v-form>
      <v-alert v-if="success" type="success" class="mt-4">
        Log operation completed successfully!
      </v-alert>
      <v-alert v-if="error" type="error" class="mt-4">
        {{ error }}
      </v-alert>
      <v-card v-if="logStats" class="mt-4">
        <v-card-title>Log Statistics</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Total Logs</v-list-item-title>
              <v-list-item-subtitle>{{ logStats.totalLogs }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Last Log Time</v-list-item-title>
              <v-list-item-subtitle>{{ logStats.lastLogTime }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Log Level Distribution</v-list-item-title>
              <v-list-item-subtitle>{{ logStats.levelDistribution }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Storage Used</v-list-item-title>
              <v-list-item-subtitle>{{ logStats.storageUsed }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
      <v-card v-if="recentLogs.length > 0" class="mt-4">
        <v-card-title>Recent Logs</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item v-for="(log, index) in recentLogs" :key="index">
              <v-list-item-title>{{ log.level }} - {{ log.source }}</v-list-item-title>
              <v-list-item-subtitle>{{ log.message }}</v-list-item-subtitle>
              <v-list-item-subtitle>{{ log.timestamp }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const logStats = ref<any>(null)
const recentLogs = ref<any[]>([])

const logSources = [
  'system',
  'application',
  'database',
  'api',
  'auth',
  'model',
  'pipeline',
  'bot'
]

const form = ref({
  logLevel: 'INFO',
  message: '',
  source: 'system',
  maxLogs: 100,
})

const resetForm = () => {
  form.value = {
    logLevel: 'INFO',
    message: '',
    source: 'system',
    maxLogs: 100,
  }
  success.value = false
  error.value = null
}

const manageLogs = async () => {
  error.value = null
  success.value = false
  loading.value = true
  
  try {
    // Simulate adding a log entry
    const newLog = {
      level: form.value.logLevel,
      message: form.value.message,
      source: form.value.source,
      timestamp: new Date().toISOString(),
    }
    
    recentLogs.value.unshift(newLog)
    
    // Keep only the specified number of logs
    if (recentLogs.value.length > form.value.maxLogs) {
      recentLogs.value = recentLogs.value.slice(0, form.value.maxLogs)
    }
    
    // Update log statistics
    updateLogStats()
    
    success.value = true
    form.value.message = '' // Clear message after adding
  } catch (err) {
    error.value = 'An unexpected error occurred while managing logs'
  } finally {
    loading.value = false
  }
}

const clearLogs = async () => {
  if (confirm('Are you sure you want to clear all logs?')) {
    recentLogs.value = []
    updateLogStats()
    success.value = true
  }
}

const exportLogs = async () => {
  try {
    const logData = recentLogs.value.map(log => 
      `${log.timestamp} [${log.level}] ${log.source}: ${log.message}`
    ).join('\n')
    
    const blob = new Blob([logData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    success.value = true
  } catch (err) {
    error.value = 'Failed to export logs'
  }
}

const updateLogStats = () => {
  const levelCounts = recentLogs.value.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  logStats.value = {
    totalLogs: recentLogs.value.length,
    lastLogTime: recentLogs.value[0]?.timestamp || 'N/A',
    levelDistribution: Object.entries(levelCounts)
      .map(([level, count]) => `${level}: ${count}`)
      .join(', '),
    storageUsed: `${(JSON.stringify(recentLogs.value).length / 1024).toFixed(2)} KB`,
  }
}

// Initialize with some sample logs
recentLogs.value = [
  {
    level: 'INFO',
    message: 'System initialized successfully',
    source: 'system',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    level: 'WARN',
    message: 'Database connection slow',
    source: 'database',
    timestamp: new Date(Date.now() - 30000).toISOString(),
  },
  {
    level: 'ERROR',
    message: 'API endpoint not found',
    source: 'api',
    timestamp: new Date(Date.now() - 10000).toISOString(),
  },
]

updateLogStats()

const goBackToDebug = () => {
  window.location.href = '/debug'
}
</script>
