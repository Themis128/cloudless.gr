<template>
  <div>
    <LayoutPageStructure
      title="Pipeline Management"
      subtitle="Create, manage, and execute AI processing pipelines"
      back-button-to="/"
      :has-sidebar="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-8">
          <v-progress-circular indeterminate size="64" color="primary"></v-progress-circular>
          <div class="mt-4 text-h6">Loading pipelines...</div>
        </div>

        <!-- Main Content -->
        <div v-else>
          <!-- Welcome Header -->
          <v-card class="mb-6 bg-gradient-primary">
            <v-card-text class="text-center py-8">
              <v-icon size="64" color="white" class="mb-4">
                mdi-pipe
              </v-icon>
              <h1 class="text-h3 font-weight-bold text-white mb-4">
                AI Pipeline Management
              </h1>
              <p class="text-h6 text-white/90 mb-6">
                Create, configure, and deploy intelligent AI processing pipelines for your applications
              </p>
              
              <!-- Quick Stats -->
              <v-row class="justify-center">
                <v-col cols="6" md="3">
                  <v-card class="text-center bg-transparent" elevation="0">
                    <v-card-text class="pa-4">
                      <div class="text-h4 font-weight-bold text-white mb-1">{{ pipelineStats.total }}</div>
                      <div class="text-white/80 text-body-2">Total Pipelines</div>
                      <v-icon color="white" class="mt-2" size="24">mdi-pipe</v-icon>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="6" md="3">
                  <v-card class="text-center bg-transparent" elevation="0">
                    <v-card-text class="pa-4">
                      <div class="text-h4 font-weight-bold text-white mb-1">{{ pipelineStats.active }}</div>
                      <div class="text-white/80 text-body-2">Active Pipelines</div>
                      <v-icon color="white" class="mt-2" size="24">mdi-play-circle</v-icon>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="6" md="3">
                  <v-card class="text-center bg-transparent" elevation="0">
                    <v-card-text class="pa-4">
                      <div class="text-h4 font-weight-bold text-white mb-1">{{ pipelineStats.running }}</div>
                      <div class="text-white/80 text-body-2">Running</div>
                      <v-icon color="white" class="mt-2" size="24">mdi-sync</v-icon>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="6" md="3">
                  <v-card class="text-center bg-transparent" elevation="0">
                    <v-card-text class="pa-4">
                      <div class="text-h4 font-weight-bold text-white mb-1">{{ performanceTrends.averageExecutionTime.toFixed(1) }}s</div>
                      <div class="text-white/80 text-body-2">Avg Execution</div>
                      <v-icon color="white" class="mt-2" size="24">mdi-timer</v-icon>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Pipeline Limit Component -->
          <PipelinesPipelineLimit />

          <!-- Pipeline Analytics Dashboard -->
          <PipelinesPipelineAnalytics />

          <!-- Pipeline List -->
          <PipelinesPipelineList @create-pipeline="showCreateDialog = true" />

          <!-- Create Pipeline Dialog -->
          <PipelinesStepperPipelineBuilder
            v-model="showCreateDialog"
            @pipeline-created="handlePipelineCreated"
          />
        </div>

        <!-- Success/Error Messages -->
        <v-snackbar
          v-model="showSuccess"
          color="success"
          timeout="3000"
          location="top"
          rounded="lg"
        >
          <template #prepend>
            <v-icon>mdi-check-circle</v-icon>
          </template>
          {{ successMessage }}
        </v-snackbar>

        <v-snackbar
          v-model="showError"
          color="error"
          timeout="5000"
          location="top"
          rounded="lg"
        >
          <template #prepend>
            <v-icon>mdi-alert-circle</v-icon>
          </template>
          {{ errorMessage }}
        </v-snackbar>
      </template>

      <template #sidebar>
        <!-- Quick Actions -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-lightning-bolt</v-icon>
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              color="primary"
              prepend-icon="mdi-plus"
              @click="showCreateDialog = true"
              class="mb-2"
              :loading="pipelineStore.loading"
              :disabled="pipelineStore.loading"
            >
              Create Pipeline
            </v-btn>
            <v-btn
              block
              variant="outlined"
              prepend-icon="mdi-import"
              @click="importPipelines"
              class="mb-2"
            >
              Import Pipelines
            </v-btn>
            <v-btn
              block
              variant="outlined"
              prepend-icon="mdi-download"
              @click="exportAllPipelines"
            >
              Export All
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Pipeline Status Overview -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-chart-pie</v-icon>
            Pipeline Status
          </v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption">Active</span>
              <v-chip size="small" color="success" variant="tonal">
                {{ pipelineStats.active }}
              </v-chip>
            </div>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-caption">Inactive</span>
              <v-chip size="small" color="warning" variant="tonal">
                {{ pipelineStats.inactive }}
              </v-chip>
            </div>
            <div class="d-flex align-center justify-space-between">
              <span class="text-caption">Running</span>
              <v-chip size="small" color="info" variant="tonal">
                {{ pipelineStats.running }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>

        <!-- Recent Activity -->
        <v-card class="mb-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-clock-outline</v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <div v-for="activity in recentActivity.slice(0, 5)" :key="activity.id" class="d-flex align-center mb-2">
              <v-avatar size="24" class="mr-2">
                <v-icon size="16" color="primary">mdi-circle</v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <div class="text-caption font-weight-medium">{{ activity.text }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatPipelineDate(activity.timestamp) }}
                </div>
              </div>
            </div>
            <div v-if="recentActivity.length === 0" class="text-center py-2">
              <div class="text-caption text-medium-emphasis">No recent activity</div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Help & Resources -->
        <v-card>
          <v-card-title class="text-subtitle-1 font-weight-bold">
            <v-icon class="mr-2">mdi-help-circle</v-icon>
            Help & Resources
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              variant="text"
              prepend-icon="mdi-book-open"
              to="/documentation/pipelines"
              class="mb-2"
            >
              Documentation
            </v-btn>
            <v-btn
              block
              variant="text"
              prepend-icon="mdi-video"
              to="/tutorials"
              class="mb-2"
            >
              Tutorials
            </v-btn>
            <v-btn
              block
              variant="text"
              prepend-icon="mdi-forum"
              to="/support"
            >
              Support
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'
import { usePipelineAnalytics } from '~/composables/usePipelineAnalytics'
import { usePipelineExecution } from '~/composables/usePipelineExecution'
import { formatPipelineDate, exportPipelineData } from '~/utils/pipelineHelpers'

// SEO Meta Tags
import { useHead } from 'nuxt/app'

// TypeScript declaration for Nuxt global functions
declare const definePageMeta: (meta: any) => void

useHead({
  title: 'Pipeline Management - Cloudless',
  meta: [
    { name: 'description', content: 'Create, manage, and execute AI processing pipelines with our comprehensive platform.' },
    { property: 'og:title', content: 'Pipeline Management - Cloudless' },
    { property: 'og:description', content: 'Create, manage, and execute AI processing pipelines' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Pipeline Management - Cloudless' },
    { name: 'twitter:description', content: 'Create, manage, and execute AI processing pipelines' }
  ]
})

definePageMeta({
  layout: 'default'
})

// Types
interface Pipeline {
  id: number
  name: string
  description?: string
  status: string
  config: string
  createdAt: Date
  updatedAt: Date
}

// Store integration
const pipelineStore = usePipelineStore()
const { pipelineStats, performanceTrends, recentActivity } = usePipelineAnalytics()
const { isAnyExecuting, executingCount } = usePipelineExecution()

// Computed properties
const isLoading = computed(() => pipelineStore.loading)

// Reactive state
const showCreateDialog = ref(false)
const showSuccess = ref(false)
const showError = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Methods
const handlePipelineCreated = (pipeline: Pipeline) => {
  showSuccess.value = true
  successMessage.value = `Pipeline "${pipeline.name}" created successfully!`
  // Refresh data after creation
  pipelineStore.fetchAll()
}

const exportAllPipelines = async () => {
  try {
    const data = exportPipelineData(pipelineStore.pipelines)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-pipelines-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showSuccess.value = true
    successMessage.value = `Exported ${pipelineStore.pipelines.length} pipelines successfully!`
  } catch (error) {
    showError.value = true
    errorMessage.value = 'Failed to export pipelines'
    console.error('Export failed:', error)
  }
}

const importPipelines = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        const text = await file.text()
        const pipelines = JSON.parse(text)
        
        // Validate and import pipelines
        for (const pipeline of pipelines) {
          await pipelineStore.createPipeline(pipeline)
        }
        
        showSuccess.value = true
        successMessage.value = `Imported ${pipelines.length} pipelines successfully!`
        // Refresh data after import
        pipelineStore.fetchAll()
      } catch (error) {
        showError.value = true
        errorMessage.value = 'Failed to import pipelines. Please check the file format.'
        console.error('Import failed:', error)
      }
    }
  }
  input.click()
}

// Client-side initialization
onMounted(async () => {
  try {
    await pipelineStore.fetchAll()
  } catch (error) {
    console.error('Failed to fetch pipelines:', error)
    showError.value = true
    errorMessage.value = 'Failed to load pipelines data'
  }
})

// Watch for store changes
watch(() => pipelineStore.error, (error) => {
  if (error) {
    showError.value = true
    errorMessage.value = error
  }
})

watch(() => pipelineStore.success, (success) => {
  if (success) {
    showSuccess.value = true
    successMessage.value = success
  }
})

// Expose methods for sidebar
defineExpose({
  exportAllPipelines,
  importPipelines
})
</script>

<style scoped>
.bg-gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
