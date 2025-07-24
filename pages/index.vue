<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-4">
          Welcome to Cloudless
        </h1>
        <p class="text-xl text-white">
          Your all-in-one low-code platform for data pipelines, analytics, and AI.
        </p>
      </div>

      <!-- Vuetify Glassmorphism Card -->
      <!-- cspell:ignore Glassmorphism -->
      <div class="flex justify-center mb-12">
        <v-card
          class="glassmorphism-card"
          elevation="0"
          max-width="800"
          rounded="xl"
        >
          <v-card-text class="pa-8">
            <!-- Header Section -->
            <div class="text-center mb-8">
              <v-icon
                size="64"
                color="primary"
                class="mb-4"
              >
                mdi-cloud-outline
              </v-icon>
              <h2 class="text-2xl font-bold text-black mb-4">
                Cloudless Platform
              </h2>
              <p class="text-lg text-white/90 mb-6">
                Experience the future of low-code development with our advanced AI-powered platform. 
                Build, deploy, and scale your applications with unprecedented ease.
              </p>
              <div class="flex flex-wrap justify-center gap-4">
                <v-btn
                  color="white"
                  variant="outlined"
                  size="large"
                  class="glassmorphism-btn"
                  to="/projects"
                >
                  <v-icon start>mdi-folder-multiple</v-icon>
                  Explore Projects
                </v-btn>
                <v-btn
                  color="white"
                  size="large"
                  class="glassmorphism-btn-primary"
                  to="/contact"
                >
                  <v-icon start>mdi-rocket-launch</v-icon>
                  Get Started
                </v-btn>
              </div>
            </div>

            <!-- Divider -->
            <v-divider class="my-6" style="border-color: rgba(255, 255, 255, 0.2);"></v-divider>

            <!-- Content Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Quick Actions Section -->
              <div>
                <h3 class="text-xl font-semibold text-black mb-4 flex items-center">
                  <v-icon class="mr-2" color="black">mdi-lightning-bolt</v-icon>
                  Quick Actions
                </h3>
                <div class="space-y-3">
                  <v-btn
                    variant="text"
                    class="glassmorphism-action-btn w-full justify-start"
                    to="/projects"
                  >
                    <v-icon start color="black">mdi-folder-multiple</v-icon>
                    <span class="text-black">Browse Projects</span>
                  </v-btn>
                  <v-btn
                    variant="text"
                    class="glassmorphism-action-btn w-full justify-start"
                    to="/contact"
                  >
                    <v-icon start color="black">mdi-email</v-icon>
                    <span class="text-black">Contact Support</span>
                  </v-btn>
                  <v-btn
                    variant="text"
                    class="glassmorphism-action-btn w-full justify-start"
                    to="/profile"
                  >
                    <v-icon start color="black">mdi-cog</v-icon>
                    <span class="text-black">Settings</span>
                  </v-btn>
                  <v-btn
                    variant="text"
                    class="glassmorphism-action-btn w-full justify-start"
                    to="/dashboard"
                  >
                    <v-icon start color="black">mdi-view-dashboard</v-icon>
                    <span class="text-black">Dashboard</span>
                  </v-btn>
                </div>
              </div>

              <!-- Recent Activity Section -->
              <div>
                <h3 class="text-xl font-semibold text-black mb-4 flex items-center">
                  <v-icon class="mr-2" color="black">mdi-clock-outline</v-icon>
                  Recent Activity
                </h3>
                <div class="space-y-3">
                  <div v-for="activity in activityData" :key="activity.id" class="flex items-center space-x-3">
                    <div class="w-2 h-2 bg-white rounded-full"></div>
                    <span class="text-sm text-white/90">{{ activity.text }}</span>
                  </div>
                  <div v-if="!activityData || activityData.length === 0" class="text-sm text-white/70 italic">
                    No recent activity
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-lg text-gray-600">Loading dashboard data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-2xl mx-auto">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
          <p class="text-red-600 mb-4">{{ error || 'Failed to load dashboard data' }}</p>
          <button 
            @click="refresh"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

             <!-- Main Content -->
       <div v-else>
         <!-- Dashboard Glassmorphism Card -->
        <v-card
          class="dashboard-glassmorphism-card mb-8"
          elevation="0"
          rounded="xl"
        >
          <v-card-text class="pa-8">
            <!-- Dashboard Header -->
            <div class="text-center mb-8">
              <v-icon
                size="48"
                color="white"
                class="mb-4"
              >
                mdi-view-dashboard
              </v-icon>
              <h2 class="text-2xl font-bold text-black mb-2">
                Dashboard Overview
              </h2>
              <p class="text-lg text-white/90">
                Manage your AI components, models, and data pipelines
              </p>
              <!-- Platform Limits Info -->
              <div class="mt-4 text-sm text-white/70">
                <span class="mr-4">Max Bots: {{ maxBots }}</span>
                <span class="mr-4">Max Pipelines: {{ maxPipelines }}</span>
                <span>Max Steps: {{ maxStepsPerPipeline }}</span>
              </div>
            </div>

            <!-- Action Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <!-- Action Cards from Dashboard Store -->
              <div 
                v-for="actionCard in dashboardStore.actionCards" 
                :key="actionCard.id"
                class="glassmorphism-inner-card"
              >
                <div class="glassmorphism-card-header" :class="`bg-${getCardColor(actionCard.id)}`">
                  <h3 class="text-lg font-semibold text-white">{{ actionCard.title }}</h3>
                </div>
                <div class="glassmorphism-card-body">
                  <p class="text-sm text-white/80 mb-4">{{ actionCard.subtitle }}</p>
                  
                  <div class="space-y-2">
                    <v-btn
                      v-for="action in actionCard.actions"
                      :key="action.id"
                      :color="action.color"
                      :variant="action.variant"
                      :size="action.size"
                      :to="action.to"
                      :href="action.href"
                      :disabled="action.disabled || actionCard.loading"
                      class="w-full justify-start glassmorphism-action-btn"
                      @click="action.onClick"
                    >
                      <v-icon start>{{ action.icon }}</v-icon>
                      {{ action.label }}
                    </v-btn>
                  </div>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <v-divider class="my-8" style="border-color: rgba(255, 255, 255, 0.2);"></v-divider>

            <!-- Metrics Section -->
            <div class="mb-6">
              <h3 class="text-xl font-semibold text-black mb-4 flex items-center justify-center">
                <v-icon class="mr-2" color="black">mdi-chart-line</v-icon>
                System Metrics
              </h3>
            </div>

            <!-- Metric Cards with Charts Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <!-- Total Bots Chart -->
              <div class="glassmorphism-metric-card">
                <div class="p-4">
                  <h4 class="text-lg font-semibold text-white mb-2 text-center">Total Bots</h4>
                  <ClientOnly>
                    <MetricChart 
                      :data="{
                        title: 'Total Bots',
                        value: 3,
                        subtitle: 'Active bots in system',
                        percentage: 12,
                        color: '#3B82F6'
                      }"
                      type="donut"
                      height="150px"
                    />
                  </ClientOnly>
                  <div class="text-center mt-2">
                    <div class="text-2xl font-bold text-white">3</div>
                    <p class="text-sm text-white/70">Active bots in system</p>
                    <div class="flex items-center justify-center mt-1">
                      <v-icon color="green" size="small" class="mr-1">mdi-trending-up</v-icon>
                      <span class="text-sm text-white/80">12%</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Active Pipelines Chart -->
              <div class="glassmorphism-metric-card">
                <div class="p-4">
                  <h4 class="text-lg font-semibold text-white mb-2 text-center">Active Pipelines</h4>
                  <ClientOnly>
                    <MetricChart 
                      :data="{
                        title: 'Active Pipelines',
                        value: 3,
                        subtitle: 'Running workflows',
                        percentage: 8,
                        color: '#10B981'
                      }"
                      type="progress"
                      height="150px"
                    />
                  </ClientOnly>
                  <div class="text-center mt-2">
                    <div class="text-2xl font-bold text-white">3</div>
                    <p class="text-sm text-white/70">Running workflows</p>
                    <div class="flex items-center justify-center mt-1">
                      <v-icon color="green" size="small" class="mr-1">mdi-trending-up</v-icon>
                      <span class="text-sm text-white/80">8%</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- AI Models Chart -->
              <div class="glassmorphism-metric-card">
                <div class="p-4">
                  <h4 class="text-lg font-semibold text-white mb-2 text-center">AI Models</h4>
                  <ClientOnly>
                    <MetricChart 
                      :data="{
                        title: 'AI Models',
                        value: 2,
                        subtitle: 'Trained models',
                        percentage: 3,
                        color: '#8B5CF6'
                      }"
                      type="trend"
                      height="150px"
                    />
                  </ClientOnly>
                  <div class="text-center mt-2">
                    <div class="text-2xl font-bold text-white">2</div>
                    <p class="text-sm text-white/70">Trained models</p>
                    <div class="flex items-center justify-center mt-1">
                      <v-icon color="green" size="small" class="mr-1">mdi-trending-up</v-icon>
                      <span class="text-sm text-white/80">3%</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- System Health Chart -->
              <div class="glassmorphism-metric-card">
                <div class="p-4">
                  <h4 class="text-lg font-semibold text-white mb-2 text-center">System Health</h4>
                  <ClientOnly>
                    <MetricChart 
                      :data="{
                        title: 'System Health',
                        value: 99.9,
                        subtitle: 'All systems operational',
                        percentage: 99.9,
                        color: '#06B6D4'
                      }"
                      type="gauge"
                      height="150px"
                    />
                  </ClientOnly>
                  <div class="text-center mt-2">
                    <div class="text-2xl font-bold text-white">Good</div>
                    <p class="text-sm text-white/70">All systems operational</p>
                    <div class="flex items-center justify-center mt-1">
                      <v-icon color="green" size="small" class="mr-1">mdi-check-circle</v-icon>
                      <span class="text-sm text-white/80">99.9%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '~/stores/dashboardStore'
import MetricChart from '~/components/ui/MetricChart.vue'

// SEO Meta Tags
useHead({
  title: 'Cloudless - AI-Powered Low-Code Platform',
  meta: [
    { name: 'description', content: 'Your all-in-one low-code platform for data pipelines, analytics, and AI.' },
    { property: 'og:title', content: 'Cloudless - AI-Powered Low-Code Platform' },
    { property: 'og:description', content: 'Build, deploy, and scale your applications with unprecedented ease.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: '/og-image.jpg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Cloudless - AI-Powered Low-Code Platform' },
    { name: 'twitter:description', content: 'Build, deploy, and scale your applications with unprecedented ease.' }
  ],
  link: [
    { rel: 'canonical', href: 'https://cloudless.gr' }
  ]
})

// Page Meta
definePageMeta({
  title: 'Home',
  description: 'Welcome to Cloudless - Your AI-powered low-code platform'
})

// Types
interface Activity {
  id: string
  text: string
}

interface DashboardData {
  actionCards: Array<{
    id: string
    title: string
    subtitle: string
    loading: boolean
    actions: Array<{
      id: string
      label: string
      icon: string
      color: string
      variant: string
      size: string
      to?: string
      href?: string
      disabled?: boolean
      onClick?: () => void
    }>
  }>
  metrics: {
    totalBots: number
    activePipelines: number
    aiModels: number
    systemHealth: number
  }
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
}

// Runtime Configuration
const config = useRuntimeConfig()
const maxBots = config.public.maxBotsPerUser
const maxPipelines = config.public.maxPipelinesPerUser
const maxStepsPerPipeline = config.public.pipelineFeatures.maxStepsPerPipeline

// Store with better typing
const dashboardStore = useDashboardStore()
const { actionCards, loading, error } = storeToRefs(dashboardStore)

// Server-side data fetching with error handling
const { data: dashboardData, error: dashboardError, pending, refresh } = await useFetch<ApiResponse<DashboardData>>('/api/dashboard', {
  default: () => ({ success: true, data: { actionCards: [], metrics: { totalBots: 0, activePipelines: 0, aiModels: 0, systemHealth: 0 } }, message: '' }),
  transform: (response: ApiResponse<DashboardData>) => response.data, // Extract data from response
  onResponse({ response }: { response: { _data: ApiResponse<DashboardData> } }) {
    // Update store with server-side data if needed
    if (response._data?.data) {
      console.log('Dashboard data received:', response._data.data)
    }
  },
  onResponseError({ response }: { response: { _data: any } }) {
    console.error('Dashboard fetch error:', response._data)
  }
})

// Activity data fetching with better error handling
const { data: activityData, error: activityError } = await useFetch<ApiResponse<Activity[]>>('/api/activity', {
  default: () => ({ success: true, data: [], message: '' }),
  transform: (response: ApiResponse<Activity[]>) => response.data, // Extract data from response
  onResponseError({ response }: { response: { _data: any } }) {
    console.error('Activity fetch error:', response._data)
  }
})

// Ensure proper return values to prevent useFetch warnings
if (!dashboardData.value) {
  dashboardData.value = { actionCards: [], metrics: { totalBots: 0, activePipelines: 0, aiModels: 0, systemHealth: 0 } }
}

if (!activityData.value) {
  activityData.value = []
}

// Error handling with proper error boundaries
if (dashboardError.value) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Failed to load dashboard data'
  })
}

if (activityError.value) {
  console.warn('Activity data failed to load, using fallback')
}

// Helper to get a color class for action cards
const getCardColor = (id: string) => {
  if (id.includes('quick-actions')) return 'blue-500'
  if (id.includes('ai-models')) return 'green-500'
  if (id.includes('data-pipelines')) return 'purple-500'
  if (id.includes('analytics-insights')) return 'indigo-500'
  if (id.includes('deployment-ops')) return 'teal-500'
  return 'gray-600' // Default
}

// Computed properties for better reactivity
const hasDashboardData = computed(() => !!dashboardData.value?.actionCards?.length)
const hasActivityData = computed(() => !!activityData.value?.length)

// Client-side initialization (fallback)
onMounted(() => {
  // Only fetch if we don't have server-side data
  if (!hasDashboardData.value) {
    dashboardStore.fetchDashboardData()
  }
})

// Watch for data changes and update store
watch(dashboardData, (newData: DashboardData | null) => {
  if (newData && !hasDashboardData.value) {
    // Update store if needed - the store handles its own data management
    console.log('Dashboard data updated:', newData)
  }
}, { immediate: true })
</script>

<style scoped>
/* Glassmorphism Card Styles */
.glassmorphism-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-card:hover {
  transform: translateY(-5px) !important;
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
}

.glassmorphism-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: white !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
}

.glassmorphism-btn-primary {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #1e40af !important;
  font-weight: 600 !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-btn-primary:hover {
  background: white !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
}

/* Ensure proper text contrast */
.glassmorphism-card h2,
.glassmorphism-card p {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Glassmorphism Action Button Styles */
.glassmorphism-action-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(5px) !important;
  border-radius: 8px !important;
  transition: all 0.3s ease !important;
  text-transform: none !important;
  font-weight: 500 !important;
}

.glassmorphism-action-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  transform: translateX(5px) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

/* Divider styling */
.v-divider {
  opacity: 0.3;
}

/* New styles for dashboard glassmorphism card */
.dashboard-glassmorphism-card {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
  transition: all 0.3s ease !important;
}

.dashboard-glassmorphism-card:hover {
  transform: translateY(-5px) !important;
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.glassmorphism-inner-card {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-inner-card:hover {
  transform: translateY(-3px) !important;
  box-shadow: 
    0 6px 20px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}

.glassmorphism-card-header {
  padding: 12px 16px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px; /* Ensure header has enough height */
}

.glassmorphism-card-body {
  padding: 16px;
}

.glassmorphism-metric-card {
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
  transition: all 0.3s ease !important;
}

.glassmorphism-metric-card:hover {
  transform: translateY(-3px) !important;
  box-shadow: 
    0 6px 20px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
}
</style>
