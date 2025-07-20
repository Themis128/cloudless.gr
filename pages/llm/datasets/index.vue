<template>
  <div>
    <PageStructure
      title="Datasets"
      subtitle="Manage and organize your training datasets"
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
                  mdi-database
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ datasets.length }}
                </div>
                <div class="text-body-2">
                  Total Datasets
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
                  {{ readyDatasets }}
                </div>
                <div class="text-body-2">
                  Ready
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
                  {{ processingDatasets }}
                </div>
                <div class="text-body-2">
                  Processing
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-2">
                  mdi-chart-pie
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ totalSize }}
                </div>
                <div class="text-body-2">
                  Total Size
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
                  label="Search Datasets"
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
                  @click="showUploadDialog = true"
                >
                  Upload Dataset
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Datasets Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-database
              </v-icon>
              Training Datasets
            </div>
            <v-chip color="info">
              {{ filteredDatasets.length }} of {{ datasets.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="filteredDatasets"
              :search="searchQuery"
              :loading="loading"
              class="elevation-0"
              :items-per-page="10"
              :items-per-page-options="[5, 10, 25, 50]"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">
                    mdi-database
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

              <template #item.type="{ item }">
                <v-chip size="small" color="info" variant="tonal">
                  {{ item.type }}
                </v-chip>
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

              <template #item.size="{ item }">
                <div class="text-body-2">
                  {{ item.size }}
                </div>
              </template>

              <template #item.samples="{ item }">
                <div class="text-body-2">
                  {{ item.samples.toLocaleString() }}
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
                    @click="() => viewDataset(item)"
                  />
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    color="warning"
                    @click="() => editDataset(item)"
                  />
                  <v-btn
                    icon="mdi-download"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => downloadDataset(item)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => deleteDataset(item)"
                  />
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>

        <!-- Upload Dialog -->
        <v-dialog v-model="showUploadDialog" max-width="600">
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-upload
              </v-icon>
              Upload Dataset
            </v-card-title>
            <v-card-text>
              <v-form ref="uploadForm">
                <v-text-field
                  v-model="uploadData.name"
                  label="Dataset Name"
                  variant="outlined"
                  required
                />
                <v-textarea
                  v-model="uploadData.description"
                  label="Description"
                  variant="outlined"
                  rows="3"
                />
                <v-select
                  v-model="uploadData.type"
                  :items="datasetTypes"
                  label="Dataset Type"
                  variant="outlined"
                  required
                />
                <v-file-input
                  v-model="uploadData.file"
                  label="Dataset File"
                  variant="outlined"
                  accept=".csv,.json,.txt,.jsonl"
                  prepend-icon="mdi-file-document"
                  required
                />
                <v-alert
                  v-if="uploadData.file"
                  type="info"
                  variant="tonal"
                  class="mt-2"
                >
                  File: {{ uploadData.file.name }} ({{ formatFileSize(uploadData.file.size) }})
                </v-alert>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="grey"
                variant="text"
                @click="showUploadDialog = false"
              >
                Cancel
              </v-btn>
              <v-btn
                color="primary"
                variant="elevated"
                :loading="uploading"
                @click="uploadDataset"
              >
                Upload
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

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
              Are you sure you want to delete the dataset "{{ datasetToDelete?.name }}"? This action cannot be undone.
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
        <LLMGuide page="datasets" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

const router = useRouter()

// Reactive data
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const showUploadDialog = ref(false)
const showDeleteDialog = ref(false)
const datasetToDelete = ref(null)
const uploading = ref(false)

// Upload form data
const uploadData = ref({
  name: '',
  description: '',
  type: '',
  file: null
})

// Mock data - replace with actual API calls
const datasets = ref([
  {
    id: '1',
    name: 'Customer Support Conversations',
    description: 'Dataset of customer support conversations for fine-tuning',
    type: 'text-generation',
    status: 'ready',
    size: '2.5GB',
    samples: 10000,
    created_at: '2024-01-15',
    format: 'jsonl'
  },
  {
    id: '2',
    name: 'Sentiment Analysis Reviews',
    description: 'Product reviews for sentiment classification training',
    type: 'text-classification',
    status: 'ready',
    size: '1.2GB',
    samples: 5000,
    created_at: '2024-01-14',
    format: 'csv'
  },
  {
    id: '3',
    name: 'Document Summarization',
    description: 'Documents and their summaries for summarization training',
    type: 'text-generation',
    status: 'processing',
    size: '3.8GB',
    samples: 8000,
    created_at: '2024-01-13',
    format: 'json'
  },
  {
    id: '4',
    name: 'Question Answering Pairs',
    description: 'Question-answer pairs for QA model training',
    type: 'question-answering',
    status: 'ready',
    size: '1.5GB',
    samples: 12000,
    created_at: '2024-01-12',
    format: 'jsonl'
  }
])

// Computed properties
const readyDatasets = computed(() => datasets.value.filter(dataset => dataset.status === 'ready').length)
const processingDatasets = computed(() => datasets.value.filter(dataset => dataset.status === 'processing').length)

const totalSize = computed(() => {
  const total = datasets.value.reduce((acc, dataset) => {
    const size = parseFloat(dataset.size.replace('GB', ''))
    return acc + size
  }, 0)
  return `${total.toFixed(1)}GB`
})

const filteredDatasets = computed(() => {
  let filtered = datasets.value

  if (statusFilter.value) {
    filtered = filtered.filter(dataset => dataset.status === statusFilter.value)
  }

  return filtered
})

// Table headers
const headers = [
  { title: 'Dataset', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Samples', key: 'samples', sortable: true },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Filter options
const statusFilters = [
  { title: 'Ready', value: 'ready' },
  { title: 'Processing', value: 'processing' },
  { title: 'Error', value: 'error' }
]

const datasetTypes = [
  { title: 'Text Generation', value: 'text-generation' },
  { title: 'Text Classification', value: 'text-classification' },
  { title: 'Question Answering', value: 'question-answering' },
  { title: 'Summarization', value: 'summarization' }
]

// Methods
const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'processing': return 'warning'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const viewDataset = (dataset: any) => {
  router.push(`/llm/datasets/${dataset.id}`)
}

const editDataset = (dataset: any) => {
  router.push(`/llm/datasets/${dataset.id}/edit`)
}

const downloadDataset = (dataset: any) => {
  // In a real app, this would download the dataset
  console.log('Downloading dataset:', dataset.name)
}

const deleteDataset = (dataset: any) => {
  datasetToDelete.value = dataset
  showDeleteDialog.value = true
}

const confirmDelete = () => {
  if (datasetToDelete.value) {
    // In a real app, this would delete from the API
    datasets.value = datasets.value.filter(dataset => dataset.id !== datasetToDelete.value.id)
    showDeleteDialog.value = false
    datasetToDelete.value = null
  }
}

const uploadDataset = async () => {
  if (!uploadData.value.name || !uploadData.value.type || !uploadData.value.file) {
    return
  }

  uploading.value = true

  // Simulate upload
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Add new dataset
  const newDataset = {
    id: Date.now().toString(),
    name: uploadData.value.name,
    description: uploadData.value.description,
    type: uploadData.value.type,
    status: 'processing',
    size: formatFileSize(uploadData.value.file.size),
    samples: Math.floor(Math.random() * 10000) + 1000,
    created_at: new Date().toISOString().split('T')[0],
    format: uploadData.value.file.name.split('.').pop()
  }

  datasets.value.unshift(newDataset)

  // Reset form
  uploadData.value = {
    name: '',
    description: '',
    type: '',
    file: null
  }

  showUploadDialog.value = false
  uploading.value = false
}

onMounted(() => {
  // Load datasets from API
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

:deep(.v-textarea .v-field__input) {
  color: black !important;
}

:deep(.v-textarea .v-field__label) {
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

:deep(.v-alert) {
  color: black !important;
}
</style> 