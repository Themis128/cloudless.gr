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

      <!-- Instructions Section -->
      <v-card class="mb-6">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-information" class="mr-2" color="info" />
          How to Use Log Management
          <v-spacer />
          <v-btn
            icon="mdi-chevron-up"
            variant="text"
            size="small"
            @click="instructionsExpanded = !instructionsExpanded"
          />
        </v-card-title>
        
        <v-expand-transition>
          <div v-show="instructionsExpanded">
            <v-card-text>
              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-target" size="20" class="mr-1" />
                  Purpose
                </h4>
                <p class="text-body-2">
                  The Log Management tool helps you view, manage, and export system logs for debugging purposes. Use this tool to monitor application activity and diagnose issues.
                </p>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-playlist-edit" size="20" class="mr-1" />
                  How to Use
                </h4>
                <ol class="text-body-2">
                  <li class="mb-2">Enter a log level (INFO, WARN, ERROR, DEBUG) to filter logs</li>
                  <li class="mb-2">Add custom log messages to test logging functionality</li>
                  <li class="mb-2">Select the log source (application, database, network, etc.)</li>
                  <li class="mb-2">Set the maximum number of logs to display</li>
                  <li class="mb-2">Use "Add Log Entry" to create test log entries</li>
                  <li class="mb-2">Use "Clear Logs" to remove old log entries</li>
                  <li class="mb-2">Use "Export Logs" to download logs for analysis</li>
                </ol>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-2">
                  <v-icon icon="mdi-lightbulb" size="20" class="mr-1" />
                  Tips
                </h4>
                <ul class="text-body-2">
                  <li>Use different log levels to categorize the importance of messages</li>
                  <li>Export logs regularly for backup and analysis</li>
                  <li>Monitor log statistics to identify patterns or issues</li>
                  <li>Clear old logs periodically to maintain performance</li>
                </ul>
              </div>
            </v-card-text>
          </div>
        </v-expand-transition>
      </v-card>

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
      <v-card v-if="logs.length > 0" class="mt-4">
        <v-card-title>Recent Logs</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="log in logs"
              :key="log.id"
              :class="`log-level-${log.level.toLowerCase()}`"
            >
              <v-list-item-title>{{ log.message }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ log.timestamp }} - {{ log.source }} ({{ log.level }})
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const loading = ref(false)
const success = ref(false)
const error = ref<string | null>(null)
const logStats = ref<any>(null)
const logs = ref<any[]>([])
const instructionsExpanded = ref(true)

const logSources = ['application', 'database', 'network', 'authentication', 'system']

const form = ref({
  logLevel: 'INFO',
  message: '',
  source: 'application',
  maxLogs: 100
})

const resetForm = () => {
  form.value = {
    logLevel: 'INFO',
    message: '',
    source: 'application',
    maxLogs: 100
  }
  success.value = false
  error.value = null
}

const goBackToDebug = () => {
  window.location.href = '/debug'
}

const manageLogs = async () => {
  loading.value = true
  success.value = false
  error.value = null
  
  try {
    // Simulate log management
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const newLog = {
      id: Date.now(),
      level: form.value.logLevel,
      message: form.value.message,
      source: form.value.source,
      timestamp: new Date().toLocaleString()
    }
    
    logs.value.unshift(newLog)
    
    // Update stats
    logStats.value = {
      totalLogs: logs.value.length,
      lastLogTime: new Date().toLocaleString(),
      levelDistribution: `${form.value.logLevel}: ${logs.value.filter(l => l.level === form.value.logLevel).length}`,
      storageUsed: `${logs.value.length * 100} bytes`
    }
    
    success.value = true
    console.log('Log entry added:', newLog)
  } catch (err: any) {
    error.value = err.message || 'Log operation failed'
    console.error('Log operation error:', err)
  } finally {
    loading.value = false
  }
}

const clearLogs = async () => {
  try {
    logs.value = []
    logStats.value = {
      totalLogs: 0,
      lastLogTime: 'N/A',
      levelDistribution: 'N/A',
      storageUsed: '0 bytes'
    }
    success.value = true
    console.log('Logs cleared')
  } catch (err: any) {
    error.value = err.message || 'Failed to clear logs'
  }
}

const exportLogs = async () => {
  try {
    const logData = JSON.stringify(logs.value, null, 2)
    const blob = new Blob([logData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    success.value = true
    console.log('Logs exported')
  } catch (err: any) {
    error.value = err.message || 'Failed to export logs'
  }
}

onMounted(() => {
  // Initialize with some sample logs
  logs.value = [
    {
      id: 1,
      level: 'INFO',
      message: 'Application started successfully',
      source: 'application',
      timestamp: new Date().toLocaleString()
    },
    {
      id: 2,
      level: 'DEBUG',
      message: 'Database connection established',
      source: 'database',
      timestamp: new Date().toLocaleString()
    }
  ]
  
  logStats.value = {
    totalLogs: logs.value.length,
    lastLogTime: new Date().toLocaleString(),
    levelDistribution: 'INFO: 1, DEBUG: 1',
    storageUsed: '200 bytes'
  }
})
</script>

<style scoped>
.log-level-error {
  border-left: 4px solid #f44336;
}

.log-level-warn {
  border-left: 4px solid #ff9800;
}

.log-level-info {
  border-left: 4px solid #2196f3;
}

.log-level-debug {
  border-left: 4px solid #4caf50;
}
</style>
