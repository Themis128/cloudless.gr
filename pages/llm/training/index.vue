<template>
  <div>
    <LayoutPageStructure
      title="Training Sessions"
      subtitle="Monitor and manage your model training jobs"
      back-button-to="/llm"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Stats Overview -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-2">
                  mdi-school
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ trainingSessions.length }}
                </div>
                <div class="text-body-2">
                  Total Sessions
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
                  {{ completedSessions }}
                </div>
                <div class="text-body-2">
                  Completed
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
                  {{ runningSessions }}
                </div>
                <div class="text-body-2">
                  Running
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="error" class="mb-2">
                  mdi-alert-circle
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ failedSessions }}
                </div>
                <div class="text-body-2">
                  Failed
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Search and Filters -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="searchQuery"
                  label="Search Training Sessions"
                  variant="outlined"
                  prepend-icon="mdi-magnify"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="statusFilter"
                  :items="statusFilters"
                  label="Status Filter"
                  variant="outlined"
                  prepend-icon="mdi-filter"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-plus"
                  @click="createTraining"
                >
                  New Training
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Training Sessions Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-school
              </v-icon>
              Training Sessions
            </div>
            <v-chip color="info">
              {{ filteredSessions.length }} of {{ trainingSessions.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="filteredSessions"
              :search="searchQuery"
              :loading="loading"
              class="elevation-0"
              :items-per-page="10"
              :items-per-page-options="[5, 10, 25, 50]"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">
                    mdi-school
                  </v-icon>
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
                  {{ item.status }}
                </v-chip>
              </template>

              <template #item.progress="{ item }">
                <div v-if="item.status === 'running'" class="d-flex align-center">
                  <v-progress-linear
                    :model-value="item.progress"
                    color="primary"
                    height="6"
                    rounded
                    class="mr-2"
                    style="width: 60px"
                  />
                  <span class="text-caption">{{ item.progress }}%</span>
                </div>
                <div v-else class="text-caption">
                  {{ item.status === 'completed' ? '100%' : 'N/A' }}
                </div>
              </template>

              <template #item.duration="{ item }">
                <div class="text-body-2">
                  {{ formatDuration(item.duration) }}
                </div>
              </template>

              <template #item.created_at="{ item }">
                <div class="text-body-2">
                  {{ formatDate(item.created_at) }}
                </div>
              </template>

              <template #item.actions="{ item }">
                <div class="d-flex gap-1">
                  <v-btn
                    icon="mdi-eye"
                    size="small"
                    variant="text"
                    color="primary"
                    @click="() => viewSession(item)"
                  />
                  <v-btn
                    v-if="item.status === 'running'"
                    icon="mdi-stop"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => stopSession(item)"
                  />
                  <v-btn
                    v-if="item.status === 'completed'"
                    icon="mdi-download"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => downloadModel(item)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => deleteSession(item)"
                  />
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="showDeleteDialog" max-width="400">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="error">
                mdi-alert-circle
              </v-icon>
              Confirm Deletion
            </v-card-title>
            <v-card-text>
              Are you sure you want to delete the training session "{{ sessionToDelete?.name }}"? This action cannot be undone.
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="grey"
                variant="text"
                @click="showDeleteDialog = false"
              >
                Cancel
              </v-btn>
              <v-btn
                color="error"
                variant="elevated"
                @click="confirmDelete"
              >
                Delete
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </template>

      <template #sidebar>
        <LLMGuide page="training" />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutPageStructure from '~/components/layout/LayoutPageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const router = useRouter()

// Reactive data
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const showDeleteDialog = ref(false)
const sessionToDelete = ref(null)

// Mock data - replace with actual API calls
const trainingSessions = ref([
  {
    id: '1',
    name: 'GPT-4 Customer Support Training',
    description: 'Fine-tuning GPT-4 for customer support conversations',
    status: 'running',
    progress: 75,
    duration: 3600, // seconds
    created_at: '2024-01-15T10:00:00Z',
    base_model: 'gpt-4',
    dataset_size: '10K examples'
  },
  {
    id: '2',
    name: 'BERT Sentiment Analysis',
    description: 'Training BERT model for sentiment classification',
    status: 'completed',
    progress: 100,
    duration: 1800,
    created_at: '2024-01-14T14:30:00Z',
    base_model: 'bert-base-uncased',
    dataset_size: '5K examples'
  },
  {
    id: '3',
    name: 'T5 Summarization Model',
    description: 'Training T5 for document summarization',
    status: 'failed',
    progress: 45,
    duration: 2400,
    created_at: '2024-01-13T09:15:00Z',
    base_model: 't5-base',
    dataset_size: '8K examples'
  },
  {
    id: '4',
    name: 'RoBERTa QA Training',
    description: 'Training RoBERTa for question answering',
    status: 'completed',
    progress: 100,
    duration: 3000,
    created_at: '2024-01-12T16:45:00Z',
    base_model: 'roberta-base',
    dataset_size: '12K examples'
  }
])

// Computed properties
const completedSessions = computed(() => trainingSessions.value.filter(session => session.status === 'completed').length)
const runningSessions = computed(() => trainingSessions.value.filter(session => session.status === 'running').length)
const failedSessions = computed(() => trainingSessions.value.filter(session => session.status === 'failed').length)

const filteredSessions = computed(() => {
  let filtered = trainingSessions.value

  if (statusFilter.value) {
    filtered = filtered.filter(session => session.status === statusFilter.value)
  }

  return filtered
})

// Table headers
const headers = [
  { title: 'Session', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Progress', key: 'progress', sortable: true },
  { title: 'Duration', key: 'duration', sortable: true },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Filter options
const statusFilters = [
  { title: 'Running', value: 'running' },
  { title: 'Completed', value: 'completed' },
  { title: 'Failed', value: 'failed' },
  { title: 'Queued', value: 'queued' }
]

// Methods
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'running': return 'info'
    case 'failed': return 'error'
    case 'queued': return 'warning'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

const createTraining = () => {
  router.push('/llm/train')
}

const viewSession = (session: any) => {
  router.push(`/llm/training/${session.id}`)
}

const stopSession = (session: any) => {
  // In a real app, this would stop the training session
      // Stopping session
}

const downloadModel = (session: any) => {
  // In a real app, this would download the trained model
      // Downloading model from session
}

const deleteSession = (session: any) => {
  sessionToDelete.value = session
  showDeleteDialog.value = true
}

const confirmDelete = () => {
  if (sessionToDelete.value) {
    // In a real app, this would delete from the API
    trainingSessions.value = trainingSessions.value.filter(session => session.id !== sessionToDelete.value.id)
    showDeleteDialog.value = false
    sessionToDelete.value = null
  }
}

onMounted(() => {
  // Load training sessions from API
  loading.value = true
  setTimeout(() => {
    loading.value = false
  }, 1000)
})
</script>

<style scoped>
.stats-card {
  transition: transform 0.2s ease;
}

.stats-card:hover {
  transform: translateY(-2px);
}

.gap-1 {
  gap: 0.25rem;
}

/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

:deep(.v-select .v-field__input) {
  color: black !important;
}

:deep(.v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-text-field .v-field__input) {
  color: black !important;
}

:deep(.v-text-field .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-btn) {
  color: black !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-dialog .v-card-title) {
  color: black !important;
}

:deep(.v-dialog .v-card-text) {
  color: black !important;
}
</style> 