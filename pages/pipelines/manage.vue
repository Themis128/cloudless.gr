<template>
  <div>
    <LayoutPageStructure
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
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'
import PipelineGuide from '~/components/step-guides/PipelineGuide.vue'

interface Pipeline {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
}

const pipelineStore = usePipelineStore()

const selectedPipelines = ref<Pipeline[]>([])
const selectedStatus = ref('')
const showConfirmDialog = ref(false)
const confirmMessage = ref('')
const pendingAction = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

// Computed properties
const pipelines = computed(() => pipelineStore.allPipelines)

const activePipelines = computed(() => {
  return pipelines.value.filter(p => p.status === 'active').length
})

const draftPipelines = computed(() => {
  return pipelines.value.filter(p => p.status === 'draft').length
})

const avgSteps = computed(() => {
  if (!pipelines.value.length) return 0
  const total = pipelines.value.reduce((sum, p) => {
    try {
      const config = JSON.parse(p.config)
      return sum + (config.steps?.length || 0)
    } catch {
      return sum
    }
  }, 0)
  return Math.round(total / pipelines.value.length)
})

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Draft', value: 'draft' },
  { title: 'Inactive', value: 'inactive' },
  { title: 'Archived', value: 'archived' }
]

const actionOptions = [
  { title: 'Update Status', value: 'updateStatus' },
  { title: 'Delete Selected', value: 'deleteSelected' },
  { title: 'Export Selected', value: 'exportSelected' }
]

// Methods
const selectPipeline = (pipeline: Pipeline) => {
  const index = selectedPipelines.value.findIndex(p => p.id === pipeline.id)
  if (index > -1) {
    selectedPipelines.value.splice(index, 1)
  } else {
    selectedPipelines.value.push(pipeline)
  }
}

const selectAllPipelines = () => {
  if (selectedPipelines.value.length === pipelines.value.length) {
    selectedPipelines.value = []
  } else {
    selectedPipelines.value = [...pipelines.value]
  }
}

const updateStatus = async () => {
  if (!selectedStatus.value || selectedPipelines.value.length === 0) return
  
  try {
    for (const pipeline of selectedPipelines.value) {
      await pipelineStore.updatePipeline(pipeline.id, { status: selectedStatus.value })
    }
    
    selectedPipelines.value = []
    selectedStatus.value = ''
  } catch (error: any) {
    console.error('Error updating status:', error)
  }
}

const deleteSelectedPipelines = async () => {
  if (selectedPipelines.value.length === 0) return
  
  try {
    for (const pipeline of selectedPipelines.value) {
      await pipelineStore.deletePipeline(pipeline.id)
    }
    
    selectedPipelines.value = []
  } catch (error: any) {
    console.error('Error deleting pipelines:', error)
  }
}

const exportSelectedPipelines = () => {
  if (selectedPipelines.value.length === 0) return
  
  const data = JSON.stringify(selectedPipelines.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pipelines-export-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const confirmAction = (action: string) => {
  pendingAction.value = action
  
  switch (action) {
    case 'updateStatus':
      confirmMessage.value = `Update status to "${selectedStatus.value}" for ${selectedPipelines.value.length} pipeline(s)?`
      break
    case 'deleteSelected':
      confirmMessage.value = `Delete ${selectedPipelines.value.length} selected pipeline(s)? This action cannot be undone.`
      break
    case 'delete':
      const pipeline = selectedPipelines.value[0]
      confirmMessage.value = `Are you sure you want to delete "${pipeline?.name}"?`
      break
  }
  
  showConfirmDialog.value = true
}

const executeAction = async () => {
  try {
    if (pendingAction.value === 'updateStatus') {
      await updateStatus()
    } else if (pendingAction.value === 'deleteSelected') {
      await deleteSelectedPipelines()
    } else if (pendingAction.value === 'delete') {
      const pipeline = selectedPipelines.value[0]
      if (pipeline) {
        await pipelineStore.deletePipeline(pipeline.id)
      }
    }
    
    selectedPipelines.value = []
    selectedStatus.value = ''
  } catch (err: any) {
    console.error('Error executing action:', err)
    error.value = err.message || 'Failed to execute action'
  } finally {
    showConfirmDialog.value = false
  }
}

const cancelAction = () => {
  showConfirmDialog.value = false
}

const refreshPipelines = async () => {
  await pipelineStore.fetchAll()
}

const editPipeline = (pipeline: Pipeline) => {
  // Navigate to edit page
  navigateTo(`/pipelines/${pipeline.id}/edit`)
}

const testPipeline = (pipeline: Pipeline) => {
  // Navigate to test page
  navigateTo(`/pipelines/test?id=${pipeline.id}`)
}

const deletePipeline = (pipeline: Pipeline) => {
  selectedPipelines.value = [pipeline]
  confirmMessage.value = `Are you sure you want to delete "${pipeline.name}"?`
  showConfirmDialog.value = true
  pendingAction.value = 'delete'
}

onMounted(() => {
  if (pipelineStore.allPipelines.length === 0) {
    pipelineStore.fetchAll()
  }
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