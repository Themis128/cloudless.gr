<template>
  <div>
    <PageStructure
      title="Manage Pipelines"
      subtitle="Administrative tools for pipeline oversight and management"
      back-button-to="/pipelines"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Management Overview -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-2">
                  mdi-pipe
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ pipelines.length }}
                </div>
                <div class="text-body-2">
                  Total Pipelines
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-2">
                  mdi-check-circle
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ activePipelines }}
                </div>
                <div class="text-body-2">
                  Active
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="warning" class="mb-2">
                  mdi-clock
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ draftPipelines }}
                </div>
                <div class="text-body-2">
                  Draft
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-2">
                  mdi-chart-line
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ avgSteps }}
                </div>
                <div class="text-body-2">
                  Avg Steps
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Bulk Actions -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            Bulk Actions
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="selectedStatus"
                  :items="statusOptions"
                  label="Change Status"
                  variant="outlined"
                  class="mb-3"
                />
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-update"
                  :disabled="!selectedStatus || selectedPipelines.length === 0"
                  @click="updateStatus"
                >
                  Update Status ({{ selectedPipelines.length }})
                </v-btn>
              </v-col>
              <v-col cols="12" md="6">
                <v-btn
                  color="error"
                  variant="outlined"
                  prepend-icon="mdi-delete"
                  :disabled="selectedPipelines.length === 0"
                  class="mb-3"
                  @click="deleteSelected"
                >
                  Delete Selected ({{ selectedPipelines.length }})
                </v-btn>
                <br>
                <v-btn
                  color="secondary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  @click="refreshPipelines"
                >
                  Refresh List
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Pipeline Management Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Pipeline Management</span>
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              placeholder="Search pipelines..."
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 300px;"
            />
          </v-card-title>
          <v-card-text>
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-2 text-body-2">
                Loading pipelines...
              </p>
            </div>

            <!-- Pipelines Table -->
            <div v-else>
              <v-data-table
                v-model="selectedPipelines"
                :headers="headers"
                :items="filteredPipelines"
                :search="searchQuery"
                show-select
                item-value="id"
                class="elevation-1"
              >
                <template #item.name="{ item }">
                  <div class="d-flex align-center">
                    <v-avatar color="primary" size="32" class="mr-3">
                      <v-icon color="white" size="16">
                        {{ getPipelineIcon(item) }}
                      </v-icon>
                    </v-avatar>
                    <div>
                      <div class="font-weight-medium">
                        {{ item.name }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ item.description || 'No description' }}
                      </div>
                    </div>
                  </div>
                </template>

                <template #item.status="{ item }">
                  <v-chip
                    :color="getStatusColor(item.status)"
                    size="small"
                    variant="tonal"
                  >
                    {{ item.status || 'draft' }}
                  </v-chip>
                </template>

                <template #item.steps="{ item }">
                  <span class="font-weight-medium">{{ stepsCount(item) }}</span>
                </template>

                <template #item.createdAt="{ item }">
                  {{ formatDate(item.createdAt) }}
                </template>

                <template #item.actions="{ item }">
                  <div class="d-flex gap-1">
                    <v-btn
                      icon="mdi-eye"
                      size="small"
                      variant="text"
                      color="primary"
                      :to="`/pipelines/${item.id}`"
                    />
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      color="warning"
                      @click="() => editPipeline(item)"
                    />
                    <v-btn
                      icon="mdi-play-circle"
                      size="small"
                      variant="text"
                      color="success"
                      @click="() => testPipeline(item)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      @click="() => deletePipeline(item)"
                    />
                  </div>
                </template>
              </v-data-table>
            </div>
          </v-card-text>
        </v-card>

        <!-- Confirmation Dialog -->
        <v-dialog v-model="showConfirmDialog" max-width="400">
          <v-card>
            <v-card-title>Confirm Action</v-card-title>
            <v-card-text>
              {{ confirmMessage }}
            </v-card-text>
            <v-card-actions>
              <v-btn color="primary" @click="confirmAction">
                Confirm
              </v-btn>
              <v-btn text @click="cancelAction">
                Cancel
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </template>

      <template #sidebar>
        <PipelineGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

interface Pipeline {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    name: string
    email: string
  }
}

const router = useRouter()
const loading = ref(false)
const pipelines = ref<Pipeline[]>([])
const selectedPipelines = ref<Pipeline[]>([])
const searchQuery = ref('')
const selectedStatus = ref('')
const showConfirmDialog = ref(false)
const confirmMessage = ref('')
const pendingAction = ref<string | null>(null)
const error = ref<string | null>(null)

const statusOptions = [
  'active',
  'draft',
  'archived',
  'deleted'
]

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Steps', key: 'steps' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const activePipelines = computed(() => 
  pipelines.value.filter(p => p.status === 'active').length
)

const draftPipelines = computed(() => 
  pipelines.value.filter(p => p.status === 'draft').length
)

const avgSteps = computed(() => {
  if (!pipelines.value.length) return 0
  const total = pipelines.value.reduce((sum, p) => sum + stepsCount(p), 0)
  return Math.round(total / pipelines.value.length)
})

const filteredPipelines = computed(() => {
  return pipelines.value
})

// Helper function to extract pipeline type from config
const getPipelineType = (pipeline: Pipeline): string => {
  try {
    const config = JSON.parse(pipeline.config)
    return config.type || 'Custom'
  } catch {
    return 'Custom'
  }
}

// Updated to fix TypeScript errors - now accepts Pipeline object instead of string
const getPipelineIcon = (pipeline: Pipeline) => {
  const type = getPipelineType(pipeline)
  switch (type) {
    case 'Data Processing': return 'mdi-database'
    case 'Model Training': return 'mdi-brain'
    case 'Inference': return 'mdi-lightning-bolt'
    default: return 'mdi-pipe'
  }
}

const getStatusColor = (status?: string) => {
  switch (status || 'draft') {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'archived': return 'info'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

const stepsCount = (pipeline: Pipeline) => {
  try {
    const config = JSON.parse(pipeline.config)
    return config.steps && Array.isArray(config.steps) ? config.steps.length : 0
  } catch {
    return 0
  }
}

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString()
}

const updateStatus = () => {
  if (!selectedStatus.value || !selectedPipelines.value.length) return
  
  confirmMessage.value = `Are you sure you want to update the status to "${selectedStatus.value}" for ${selectedPipelines.value.length} pipeline(s)?`
  showConfirmDialog.value = true
  pendingAction.value = 'updateStatus'
}

const deleteSelected = () => {
  if (!selectedPipelines.value.length) return
  
  confirmMessage.value = `Are you sure you want to delete ${selectedPipelines.value.length} pipeline(s)?`
  showConfirmDialog.value = true
  pendingAction.value = 'deleteSelected'
}

const confirmAction = async () => {
  try {
    if (pendingAction.value === 'updateStatus') {
      // Update status for selected pipelines
      for (const pipeline of selectedPipelines.value) {
        await $fetch(`/api/prisma/pipelines/${pipeline.id}`, {
          method: 'PUT',
          body: { status: selectedStatus.value }
        })
      }
    } else if (pendingAction.value === 'deleteSelected') {
      // Delete selected pipelines
      for (const pipeline of selectedPipelines.value) {
        await $fetch(`/api/prisma/pipelines/${pipeline.id}`, {
          method: 'DELETE'
        })
      }
    } else if (pendingAction.value === 'delete') {
      // Delete single pipeline
      const pipeline = selectedPipelines.value[0]
      if (pipeline) {
        await $fetch(`/api/prisma/pipelines/${pipeline.id}`, {
          method: 'DELETE'
        })
      }
    }
    
    // Refresh the list
    await loadPipelines()
  } catch (err: any) {
    console.error('Error executing action:', err)
    error.value = err.message || 'Failed to execute action'
  } finally {
    showConfirmDialog.value = false
    selectedPipelines.value = []
    selectedStatus.value = ''
  }
}

const cancelAction = () => {
  showConfirmDialog.value = false
}

const refreshPipelines = async () => {
  await loadPipelines()
}

const editPipeline = (pipeline: Pipeline) => {
  // Navigate to edit page
  router.push(`/pipelines/${pipeline.id}/edit`)
}

const testPipeline = (pipeline: Pipeline) => {
  // Navigate to test page
  router.push(`/pipelines/test?id=${pipeline.id}`)
}

const deletePipeline = (pipeline: Pipeline) => {
  selectedPipelines.value = [pipeline]
  confirmMessage.value = `Are you sure you want to delete "${pipeline.name}"?`
  showConfirmDialog.value = true
  pendingAction.value = 'delete'
}

const loadPipelines = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await $fetch<{ success: boolean; data: Pipeline[]; message?: string }>('/api/prisma/pipelines')
    
    if (response.success) {
      pipelines.value = response.data || []
    } else {
      error.value = response.message || 'Failed to load pipelines'
    }
  } catch (err: any) {
    console.error('Error loading pipelines:', err)
    error.value = err.message || 'Failed to load pipelines'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPipelines()
})
</script>

<style scoped>
.stats-card {
  transition: transform 0.2s ease-in-out;
  cursor: pointer;
}

.stats-card:hover {
  transform: translateY(-4px);
}

.gap-1 {
  gap: 0.25rem;
}
</style> 