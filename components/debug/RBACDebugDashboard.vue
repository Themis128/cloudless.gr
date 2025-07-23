<template>
  <div class="rbac-debug-dashboard">
    <div class="dashboard-header">
      <h1>RBAC Debug Dashboard</h1>
      <div class="header-controls">
        <v-btn
          :color="isEnabled ? 'success' : 'error'"
          variant="outlined"
          @click="toggleDebug"
        >
          <v-icon>{{ isEnabled ? 'mdi-debug' : 'mdi-debug-off' }}</v-icon>
          {{ isEnabled ? 'Debug Enabled' : 'Debug Disabled' }}
        </v-btn>
        <v-btn color="warning" variant="outlined" @click="clearLogs">
          <v-icon>mdi-delete</v-icon>
          Clear Logs
        </v-btn>
        <v-btn color="info" variant="outlined" @click="exportLogs">
          <v-icon>mdi-download</v-icon>
          Export Logs
        </v-btn>
      </div>
    </div>

    <div class="dashboard-content">
      <!-- Stats Overview -->
      <div class="stats-section">
        <h2>System Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ authStats.total }}</div>
            <div class="stat-label">Total Auth Events</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ permissionStats.total }}</div>
            <div class="stat-label">Permission Checks</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ authStats.successRate.toFixed(1) }}%</div>
            <div class="stat-label">Success Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ permissionStats.grantRate.toFixed(1) }}%</div>
            <div class="stat-label">Permission Grant Rate</div>
          </div>
        </div>
      </div>

      <!-- Real-time Logs -->
      <div class="logs-section">
        <h2>Real-time Logs</h2>
        <div class="logs-controls">
          <v-select
            v-model="selectedLogLevel"
            :items="logLevels"
            label="Log Level"
            density="compact"
            style="max-width: 150px"
          />
          <v-text-field
            v-model="logFilter"
            label="Filter logs"
            density="compact"
            prepend-icon="mdi-magnify"
            style="max-width: 300px"
          />
        </div>
        <div class="logs-container">
          <div
            v-for="log in filteredLogs"
            :key="`${log.timestamp}-${log.component}-${log.message}`"
            class="log-entry"
            :class="`log-${log.level}`"
          >
            <div class="log-header">
              <span class="log-timestamp">{{ formatTime(log.timestamp) }}</span>
              <span class="log-level">{{ log.level.toUpperCase() }}</span>
              <span class="log-component">{{ log.component }}</span>
              <span v-if="log.userId" class="log-user">User: {{ log.userId }}</span>
            </div>
            <div class="log-message">{{ log.message }}</div>
            <div v-if="log.data" class="log-data">
              <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Permission Analytics -->
      <div class="analytics-section">
        <h2>Permission Analytics</h2>
        <div class="analytics-grid">
          <div class="chart-container">
            <h3>Permission Checks by Resource</h3>
            <div class="resource-stats">
              <div
                v-for="(stats, resource) in permissionStats.resourceStats"
                :key="resource"
                class="resource-stat"
              >
                <div class="resource-name">{{ resource }}</div>
                <div class="resource-bar">
                  <div
                    class="resource-granted"
                    :style="{ width: `${(stats.granted / stats.total) * 100}%` }"
                  ></div>
                  <div
                    class="resource-denied"
                    :style="{ width: `${(stats.denied / stats.total) * 100}%` }"
                  ></div>
                </div>
                <div class="resource-numbers">
                  {{ stats.granted }}/{{ stats.total }} ({{ ((stats.granted / stats.total) * 100).toFixed(1) }}%)
                </div>
              </div>
            </div>
          </div>

          <div class="chart-container">
            <h3>Auth Events by Type</h3>
            <div class="event-stats">
              <div
                v-for="(count, type) in authEventCounts"
                :key="type"
                class="event-stat"
              >
                <div class="event-type">{{ formatEventType(type) }}</div>
                <div class="event-count">{{ count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="activity-section">
        <h2>Recent Activity</h2>
        <div class="activity-tabs">
          <v-tabs v-model="activeTab">
            <v-tab value="auth">Auth Events</v-tab>
            <v-tab value="permissions">Permission Checks</v-tab>
            <v-tab value="logs">All Logs</v-tab>
          </v-tabs>
        </div>

        <div class="activity-content">
          <!-- Auth Events Tab -->
          <div v-if="activeTab === 'auth'" class="activity-list">
            <div
              v-for="event in recentAuthEvents"
              :key="`${event.timestamp}-${event.type}`"
              class="activity-item"
              :class="`event-${event.type}`"
            >
              <div class="activity-icon">
                <v-icon>{{ getEventIcon(event.type) }}</v-icon>
              </div>
              <div class="activity-details">
                <div class="activity-title">{{ formatEventType(event.type) }}</div>
                <div class="activity-time">{{ formatTime(event.timestamp) }}</div>
                <div v-if="event.userId" class="activity-user">User ID: {{ event.userId }}</div>
                <div v-if="event.data" class="activity-data">
                  <pre>{{ JSON.stringify(event.data, null, 2) }}</pre>
                </div>
              </div>
              <div class="activity-status">
                <v-icon :color="event.success ? 'success' : 'error'">
                  {{ event.success ? 'mdi-check-circle' : 'mdi-close-circle' }}
                </v-icon>
              </div>
            </div>
          </div>

          <!-- Permission Checks Tab -->
          <div v-if="activeTab === 'permissions'" class="activity-list">
            <div
              v-for="check in recentPermissionChecks"
              :key="`${check.timestamp}-${check.resource}-${check.action}`"
              class="activity-item"
              :class="`permission-${check.result ? 'granted' : 'denied'}`"
            >
              <div class="activity-icon">
                <v-icon :color="check.result ? 'success' : 'error'">
                  {{ check.result ? 'mdi-shield-check' : 'mdi-shield-close' }}
                </v-icon>
              </div>
              <div class="activity-details">
                <div class="activity-title">{{ check.resource }}:{{ check.action }}</div>
                <div class="activity-time">{{ formatTime(check.timestamp) }}</div>
                <div v-if="check.userId" class="activity-user">User ID: {{ check.userId }}</div>
                <div v-if="check.context" class="activity-context">Context: {{ check.context }}</div>
              </div>
              <div class="activity-status">
                <v-chip :color="check.result ? 'success' : 'error'" size="small">
                  {{ check.result ? 'GRANTED' : 'DENIED' }}
                </v-chip>
              </div>
            </div>
          </div>

          <!-- All Logs Tab -->
          <div v-if="activeTab === 'logs'" class="activity-list">
            <div
              v-for="log in recentLogs"
              :key="`${log.timestamp}-${log.component}-${log.message}`"
              class="activity-item"
              :class="`log-${log.level}`"
            >
              <div class="activity-icon">
                <v-icon :color="getLogLevelColor(log.level)">
                  {{ getLogLevelIcon(log.level) }}
                </v-icon>
              </div>
              <div class="activity-details">
                <div class="activity-title">{{ log.component }}</div>
                <div class="activity-message">{{ log.message }}</div>
                <div class="activity-time">{{ formatTime(log.timestamp) }}</div>
                <div v-if="log.userId" class="activity-user">User ID: {{ log.userId }}</div>
                <div v-if="log.data" class="activity-data">
                  <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
                </div>
              </div>
              <div class="activity-status">
                <v-chip :color="getLogLevelColor(log.level)" size="small">
                  {{ log.level.toUpperCase() }}
                </v-chip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// RBAC Debugger
const {
  isEnabled,
  enable,
  disable,
  logs,
  permissionChecks,
  authEvents,
  getPermissionStats,
  getAuthStats,
  getRecentActivity,
  clearLogs: clearDebugLogs,
  exportLogs: exportDebugLogs
} = useRBACDebugger()

// Local state
const selectedLogLevel = ref('all')
const logFilter = ref('')
const activeTab = ref('auth')

// Computed properties
const logLevels = computed(() => [
  { title: 'All', value: 'all' },
  { title: 'Info', value: 'info' },
  { title: 'Warn', value: 'warn' },
  { title: 'Error', value: 'error' },
  { title: 'Debug', value: 'debug' }
])

const filteredLogs = computed(() => {
  let filtered = logs.value

  if (selectedLogLevel.value !== 'all') {
    filtered = filtered.filter(log => log.level === selectedLogLevel.value)
  }

  if (logFilter.value) {
    const filter = logFilter.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(filter) ||
      log.component.toLowerCase().includes(filter)
    )
  }

  return filtered.slice(-100) // Show last 100 logs
})

const permissionStats = computed(() => getPermissionStats())
const authStats = computed(() => getAuthStats())

const authEventCounts = computed(() => {
  const counts: Record<string, number> = {}
  authEvents.value.forEach(event => {
    counts[event.type] = (counts[event.type] || 0) + 1
  })
  return counts
})

const recentAuthEvents = computed(() => authEvents.value.slice(-20))
const recentPermissionChecks = computed(() => permissionChecks.value.slice(-20))
const recentLogs = computed(() => logs.value.slice(-20))

// Methods
const toggleDebug = () => {
  if (isEnabled.value) {
    disable()
  } else {
    enable()
  }
}

const clearLogs = () => {
  clearDebugLogs()
}

const exportLogs = () => {
  const data = exportDebugLogs()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rbac-debug-logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatEventType = (type: string) => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const getEventIcon = (type: string) => {
  const icons: Record<string, string> = {
    login: 'mdi-login',
    logout: 'mdi-logout',
    register: 'mdi-account-plus',
    token_refresh: 'mdi-refresh',
    permission_check: 'mdi-shield-check',
    role_assignment: 'mdi-account-cog'
  }
  return icons[type] || 'mdi-help'
}

const getLogLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    info: 'info',
    warn: 'warning',
    error: 'error',
    debug: 'grey'
  }
  return colors[level] || 'grey'
}

const getLogLevelIcon = (level: string) => {
  const icons: Record<string, string> = {
    info: 'mdi-information',
    warn: 'mdi-alert',
    error: 'mdi-alert-circle',
    debug: 'mdi-bug'
  }
  return icons[level] || 'mdi-help'
}

// Auto-refresh
let refreshInterval: NodeJS.Timeout

onMounted(() => {
  refreshInterval = setInterval(() => {
    // Force reactivity updates
  }, 1000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.rbac-debug-dashboard {
  padding: 2rem;
  background: #f8f9fa;
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dashboard-header h1 {
  margin: 0;
  color: #333;
  font-size: 1.75rem;
  font-weight: 600;
}

.header-controls {
  display: flex;
  gap: 1rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-section,
.logs-section,
.analytics-section,
.activity-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stats-section h2,
.logs-section h2,
.analytics-section h2,
.activity-section h2 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.25rem;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #666;
  font-size: 0.875rem;
}

.logs-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.log-entry {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.log-error {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
}

.log-entry.log-warn {
  background: #fffbeb;
  border-left: 4px solid #f59e0b;
}

.log-entry.log-info {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
}

.log-entry.log-debug {
  background: #f9fafb;
  border-left: 4px solid #6b7280;
}

.log-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.log-timestamp {
  color: #666;
}

.log-level {
  text-transform: uppercase;
  font-weight: 700;
}

.log-component {
  color: #667eea;
}

.log-user {
  color: #059669;
}

.log-message {
  margin-bottom: 0.5rem;
}

.log-data {
  background: #1f2937;
  color: #f9fafb;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.chart-container h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.resource-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.resource-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.resource-name {
  min-width: 100px;
  font-weight: 600;
  color: #333;
}

.resource-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
}

.resource-granted {
  background: #10b981;
  height: 100%;
}

.resource-denied {
  background: #ef4444;
  height: 100%;
}

.resource-numbers {
  min-width: 80px;
  font-size: 0.875rem;
  color: #666;
  text-align: right;
}

.event-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.event-type {
  font-weight: 600;
  color: #333;
}

.event-count {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.activity-tabs {
  margin-bottom: 1rem;
}

.activity-list {
  max-height: 500px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s ease;
}

.activity-item:hover {
  background: #f8f9fa;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-details {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.activity-message {
  color: #666;
  margin-bottom: 0.25rem;
}

.activity-time {
  font-size: 0.875rem;
  color: #999;
  margin-bottom: 0.25rem;
}

.activity-user,
.activity-context {
  font-size: 0.875rem;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.activity-data {
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.activity-status {
  flex-shrink: 0;
}

/* Event type specific styles */
.activity-item.event-login {
  border-left: 4px solid #10b981;
}

.activity-item.event-logout {
  border-left: 4px solid #6b7280;
}

.activity-item.event-register {
  border-left: 4px solid #3b82f6;
}

.activity-item.event-permission_check {
  border-left: 4px solid #f59e0b;
}

.activity-item.permission-granted {
  border-left: 4px solid #10b981;
}

.activity-item.permission-denied {
  border-left: 4px solid #ef4444;
}

@media (max-width: 768px) {
  .rbac-debug-dashboard {
    padding: 1rem;
  }
  
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .header-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .analytics-grid {
    grid-template-columns: 1fr;
  }
  
  .activity-item {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .activity-status {
    align-self: flex-end;
  }
}
</style> 