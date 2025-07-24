<template>
  <div>
    <LayoutPageStructure
      title="Redis Analytics"
      subtitle="Monitor and analyze Redis performance, memory usage, and system health"
      :show-back-button="true"
      back-button-to="/admin"
    >
      <template #main>
        <!-- Page Header -->
        <v-card class="mb-6 bg-white">
          <v-card-title class="d-flex justify-space-between align-center">
            <div class="d-flex align-center">
              <v-icon size="32" color="primary" class="mr-3">
                mdi-database
              </v-icon>
              <div>
                <h1 class="text-h4 font-weight-bold">Redis Analytics Dashboard</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">
                  Real-time monitoring and performance analysis
                </p>
              </div>
            </div>
            <div class="d-flex gap-2">
              <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-refresh"
                :loading="loading"
                @click="refreshData"
              >
                Refresh
              </v-btn>
              <v-btn
                color="secondary"
                variant="outlined"
                prepend-icon="mdi-cog"
                @click="showSettings = true"
              >
                Settings
              </v-btn>
            </div>
          </v-card-title>
        </v-card>

        <!-- Redis Analytics Component -->
        <RedisAnalytics ref="redisAnalyticsRef" />

        <!-- Quick Actions -->
        <v-card class="mt-6 bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-lightning-bolt
            </v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  block
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-memory"
                  @click="optimizeMemory"
                  :loading="optimizing"
                >
                  Optimize Memory
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  block
                  color="warning"
                  variant="outlined"
                  prepend-icon="mdi-delete"
                  @click="clearCache"
                  :loading="clearing"
                >
                  Clear Cache
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  block
                  color="info"
                  variant="outlined"
                  prepend-icon="mdi-chart-line"
                  @click="exportMetrics"
                  :loading="exporting"
                >
                  Export Metrics
                </v-btn>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-btn
                  block
                  color="success"
                  variant="outlined"
                  prepend-icon="mdi-monitor-dashboard"
                  @click="openRedisCommander"
                >
                  Redis Commander
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Performance History -->
        <v-card class="mt-6 bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-chart-timeline-variant
            </v-icon>
            Performance History
          </v-card-title>
          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <template #title>
                Performance Tracking
              </template>
              <p class="mb-0">
                Historical performance data will be available here. This feature tracks Redis performance over time
                and provides insights into usage patterns and optimization opportunities.
              </p>
            </v-alert>
            
            <v-row>
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">Memory Usage Trend</v-card-title>
                  <v-card-text class="text-center py-8">
                    <v-icon size="64" color="primary" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p class="text-medium-emphasis">
                      Memory usage tracking will be displayed here
                    </p>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">Cache Hit Rate Trend</v-card-title>
                  <v-card-text class="text-center py-8">
                    <v-icon size="64" color="success" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p class="text-medium-emphasis">
                      Cache hit rate tracking will be displayed here
                    </p>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <!-- Redis Status -->
        <v-card class="mb-4 bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-information
            </v-icon>
            Redis Status
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>Connection Status</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip color="success" size="small">
                    Connected
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Version</v-list-item-title>
                <v-list-item-subtitle>7.4.5</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Port</v-list-item-title>
                <v-list-item-subtitle>6379</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Host</v-list-item-title>
                <v-list-item-subtitle>localhost</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Quick Stats -->
        <v-card class="mb-4 bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-chart-box
            </v-icon>
            Quick Stats
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <v-list-item-title>Memory Usage</v-list-item-title>
                <v-list-item-subtitle>0.4% (1MB / 256MB)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Cache Hit Rate</v-list-item-title>
                <v-list-item-subtitle>0% (0 hits / 0 misses)</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Total Keys</v-list-item-title>
                <v-list-item-subtitle>0 keys</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Operations/sec</v-list-item-title>
                <v-list-item-subtitle>5 ops</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Help & Documentation -->
        <v-card class="bg-white">
          <v-card-title>
            <v-icon start color="primary">
              mdi-help-circle
            </v-icon>
            Help & Documentation
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item
                v-for="(item, index) in helpItems"
                :key="index"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <v-list-item-title>{{ item.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>

    <!-- Settings Dialog -->
    <v-dialog v-model="showSettings" max-width="600">
      <v-card>
        <v-card-title>
          <v-icon start color="primary">
            mdi-cog
          </v-icon>
          Redis Analytics Settings
        </v-card-title>
        <v-card-text>
          <v-form ref="settingsForm">
            <v-text-field
              v-model="settings.refreshInterval"
              label="Refresh Interval (seconds)"
              type="number"
              min="10"
              max="300"
              hint="How often to refresh the analytics data"
              persistent-hint
            />
            <v-switch
              v-model="settings.autoRefresh"
              label="Auto Refresh"
              hint="Automatically refresh data"
              persistent-hint
            />
            <v-switch
              v-model="settings.showSlowQueries"
              label="Show Slow Queries"
              hint="Display slow query information"
              persistent-hint
            />
            <v-switch
              v-model="settings.showLargestKeys"
              label="Show Largest Keys"
              hint="Display largest keys analysis"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="showSettings = false">
            Cancel
          </v-btn>
          <v-btn color="primary" @click="saveSettings">
            Save Settings
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import RedisAnalytics from '~/components/admin/RedisAnalytics.vue'

// Define the layout and middleware
definePageMeta({
  layout: 'default',
  middleware: 'admin'
})

// Component refs
const redisAnalyticsRef = ref<InstanceType<typeof RedisAnalytics> | null>(null)

// State
const loading = ref(false)
const optimizing = ref(false)
const clearing = ref(false)
const exporting = ref(false)
const showSettings = ref(false)

// Settings
const settings = reactive({
  refreshInterval: 30,
  autoRefresh: true,
  showSlowQueries: true,
  showLargestKeys: true,
})

// Help items
const helpItems = [
  {
    title: 'Redis Documentation',
    description: 'Official Redis documentation and guides',
    url: 'https://redis.io/documentation',
  },
  {
    title: 'Redis Commander',
    description: 'Web-based Redis management interface',
    url: 'http://localhost:8081',
  },
  {
    title: 'Performance Tuning',
    description: 'Redis performance optimization guide',
    url: 'https://redis.io/topics/optimization',
  },
  {
    title: 'Memory Optimization',
    description: 'Redis memory management best practices',
    url: 'https://redis.io/topics/memory-optimization',
  },
]

// Methods
const refreshData = async () => {
  loading.value = true
  try {
    if (redisAnalyticsRef.value) {
      await redisAnalyticsRef.value.fetchAnalytics()
    }
  } catch (error) {
    console.error('Error refreshing data:', error)
  } finally {
    loading.value = false
  }
}

const optimizeMemory = async () => {
  optimizing.value = true
  try {
    // Call Redis optimization
    await $fetch('/api/admin/redis-optimize', { method: 'POST' })
    await refreshData()
  } catch (error) {
    console.error('Error optimizing memory:', error)
  } finally {
    optimizing.value = false
  }
}

const clearCache = async () => {
  clearing.value = true
  try {
    // Call Redis cache clear
    await $fetch('/api/admin/redis-clear', { method: 'POST' })
    await refreshData()
  } catch (error) {
    console.error('Error clearing cache:', error)
  } finally {
    clearing.value = false
  }
}

const exportMetrics = async () => {
  exporting.value = true
  try {
    const response = await $fetch('/api/admin/redis-export', { method: 'GET' })
    
    // Create and download file
    const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redis-metrics-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error('Error exporting metrics:', error)
  } finally {
    exporting.value = false
  }
}

const openRedisCommander = () => {
  window.open('http://localhost:8081', '_blank')
}

const saveSettings = () => {
  // Save settings to localStorage or API
  localStorage.setItem('redis-analytics-settings', JSON.stringify(settings))
  showSettings.value = false
}

// Load settings on mount
onMounted(() => {
  const savedSettings = localStorage.getItem('redis-analytics-settings')
  if (savedSettings) {
    Object.assign(settings, JSON.parse(savedSettings))
  }
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
}

.v-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}
</style> 