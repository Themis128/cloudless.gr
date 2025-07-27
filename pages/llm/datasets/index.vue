<template>
  <div>
    <ClientOnly>
      <LayoutPageStructure
        title="Datasets"
        subtitle="Manage and organize your training datasets"
        back-button-to="/llm"
        :has-sidebar="true"
        :white-header="true"
      >
        <template #main>
          <!-- Stats Overview -->
          <v-row class="mb-6" dense>
            <v-col cols="12" md="3">
              <v-card class="text-center">
                <v-card-text>
                  <v-icon size="48" color="primary">mdi-database</v-icon>
                  <div class="text-h4 font-weight-bold">{{ datasets.length }}</div>
                  <div class="text-caption">Total Datasets</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="text-center">
                <v-card-text>
                  <v-icon size="48" color="success">mdi-check-circle</v-icon>
                  <div class="text-h4 font-weight-bold">{{ readyDatasets }}</div>
                  <div class="text-caption">Ready</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="text-center">
                <v-card-text>
                  <v-icon size="48" color="warning">mdi-clock-outline</v-icon>
                  <div class="text-h4 font-weight-bold">{{ processingDatasets }}</div>
                  <div class="text-caption">Processing</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="3">
              <v-card class="text-center">
                <v-card-text>
                  <v-icon size="48" color="info">mdi-chart-pie</v-icon>
                  <div class="text-h4 font-weight-bold">{{ totalSize }}</div>
                  <div class="text-caption">Total Size</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Search and Filters -->
          <v-card class="mb-6">
            <v-card-text>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="searchQuery"
                    label="Search Datasets"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="statusFilter"
                    :items="statusFilters"
                    label="Status Filter"
                    item-title="label"
                    item-value="value"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-plus"
                    block
                    @click="showUploadDialog = true"
                  >
                    Upload Dataset
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Error/Success Messages -->
          <v-alert
            v-if="datasetStore.error"
            type="error"
            class="mb-4"
            closable
            @click:close="datasetStore.clearMessages"
          >
            {{ datasetStore.error }}
          </v-alert>
          <v-alert
            v-if="datasetStore.success"
            type="success"
            class="mb-4"
            closable
            @click:close="datasetStore.clearMessages"
          >
            {{ datasetStore.success }}
          </v-alert>

          <!-- Datasets Table -->
          <v-card>
            <v-card-title class="d-flex align-center justify-space-between">
              <span class="font-weight-semibold">Training Datasets</span>
              <v-chip color="info" variant="tonal">
                {{ filteredDatasets.length }} of {{ datasets.length }}
              </v-chip>
            </v-card-title>
            <v-data-table
              :headers="tableHeaders"
              :items="filteredDatasets"
              :loading="loading"
              class="elevation-0"
              :search="searchQuery"
              item-key="id"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon size="18" color="primary" class="mr-2">mdi-database</v-icon>
                  <div>
                    <div class="font-weight-medium">{{ item.name }}</div>
                    <div class="text-caption text-grey">{{ item.description || 'No description' }}</div>
                  </div>
                </div>
              </template>
              <template #item.type="{ item }">
                <v-chip color="info" size="small" variant="tonal">{{ item.type }}</v-chip>
              </template>
              <template #item.status="{ item }">
                <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">{{ item.status }}</v-chip>
              </template>
              <template #item.size="{ item }">
                {{ item.size }}
              </template>
              <template #item.samples="{ item }">
                {{ item.samples?.toLocaleString() || 'N/A' }}
              </template>
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template #item.actions="{ item }">
                <v-btn icon size="small" @click="viewDataset(item)"><v-icon>mdi-eye</v-icon></v-btn>
                <v-btn icon size="small" @click="editDataset(item)"><v-icon>mdi-pencil</v-icon></v-btn>
                <v-btn icon size="small" @click="downloadDataset(item)"><v-icon>mdi-download</v-icon></v-btn>
                <v-btn icon size="small" color="error" @click="deleteDataset(item)"><v-icon>mdi-delete</v-icon></v-btn>
              </template>
            </v-data-table>
          </v-card>

          <!-- Upload Dialog -->
          <v-dialog v-model="showUploadDialog" max-width="500">
            <v-card>
              <v-card-title>
                <v-icon color="primary" class="mr-2">mdi-upload</v-icon>
                Upload Dataset
              </v-card-title>
              <v-card-text>
                <v-form @submit.prevent="uploadDataset">
                  <v-text-field
                    v-model="uploadData.name"
                    label="Dataset Name"
                    required
                  />
                  <v-textarea
                    v-model="uploadData.description"
                    label="Description"
                    rows="3"
                  />
                  <v-select
                    v-model="uploadData.type"
                    :items="datasetTypes"
                    label="Dataset Type"
                    item-title="label"
                    item-value="value"
                    required
                  />
                  <v-file-input
                    v-model="uploadData.file"
                    label="Dataset File"
                    accept=".csv,.json,.txt,.jsonl"
                    show-size
                    required
                  />
                  <v-alert
                    v-if="uploadData.file"
                    type="info"
                    class="mt-2"
                  >
                    File: {{ uploadData.file?.name }} ({{ formatFileSize(uploadData.file?.size) }})
                  </v-alert>
                </v-form>
              </v-card-text>
              <v-card-actions class="justify-end">
                <v-btn text @click="showUploadDialog = false">Cancel</v-btn>
                <v-btn color="primary" :loading="uploading" @click="uploadDataset">Upload</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <!-- Delete Confirmation Dialog -->
          <v-dialog v-model="showDeleteDialog" max-width="400">
            <v-card>
              <v-card-title>
                <v-icon color="error" class="mr-2">mdi-alert</v-icon>
                Confirm Delete
              </v-card-title>
              <v-card-text>
                Are you sure you want to delete the dataset "{{ datasetToDelete?.name }}"? This action cannot be undone.
              </v-card-text>
              <v-card-actions class="justify-end">
                <v-btn text @click="showDeleteDialog = false">Cancel</v-btn>
                <v-btn color="error" @click="confirmDelete">Delete</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </template>
        <template #sidebar>
          <LLMGuide page="datasets" />
        </template>
      </LayoutPageStructure>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutPageStructure from '~/components/layout/LayoutPageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'
import { useDatasetStore } from '~/stores/datasetStore'

const router = useRouter()
const datasetStore = useDatasetStore()

const searchQuery = ref('')
const statusFilter = ref('')
const showUploadDialog = ref(false)
const showDeleteDialog = ref(false)
const datasetToDelete = ref<any>(null)

const uploadData = ref<{
  name: string
  description: string
  type: string
  file: File | null
}>({
  name: '',
  description: '',
  type: '',
  file: null,
})

const loading = computed(() => datasetStore.loading)
const uploading = computed(() => datasetStore.uploading)
const datasets = computed(() => datasetStore.allDatasets)
const readyDatasets = computed(() => datasetStore.readyDatasets.length)
const processingDatasets = computed(() => datasetStore.processingDatasets.length)
const totalSize = computed(() => datasetStore.totalSize)

const filteredDatasets = computed(() => {
  let filtered = datasets.value
  if (statusFilter.value) {
    filtered = filtered.filter(dataset => dataset.status === statusFilter.value)
  }
  return filtered
})

const tableHeaders = [
  { text: 'Dataset', value: 'name', sortable: true },
  { text: 'Type', value: 'type', sortable: true },
  { text: 'Status', value: 'status', sortable: true },
  { text: 'Size', value: 'size', sortable: true },
  { text: 'Samples', value: 'samples', sortable: true },
  { text: 'Created', value: 'createdAt', sortable: true },
  { text: 'Actions', value: 'actions', sortable: false },
]

const statusFilters = [
  { label: 'Ready', value: 'ready' },
  { label: 'Processing', value: 'processing' },
  { label: 'Error', value: 'error' },
]

const datasetTypes = [
  { label: 'Text Generation', value: 'text-generation' },
  { label: 'Text Classification', value: 'text-classification' },
  { label: 'Question Answering', value: 'question-answering' },
  { label: 'Summarization', value: 'summarization' },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready':
      return 'success'
    case 'processing':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 Bytes'
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

const downloadDataset = async (dataset: any) => {
  try {
    await datasetStore.downloadDataset(dataset.id)
  } catch (error) {
    console.error('Download failed:', error)
  }
}

const deleteDataset = (dataset: any) => {
  datasetToDelete.value = dataset
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (datasetToDelete.value) {
    try {
      await datasetStore.deleteDataset(datasetToDelete.value.id)
      showDeleteDialog.value = false
      datasetToDelete.value = null
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }
}

const uploadDataset = async () => {
  if (!uploadData.value.name || !uploadData.value.type || !uploadData.value.file) {
    return
  }
  try {
    const form = {
      name: uploadData.value.name,
      description: uploadData.value.description,
      type: uploadData.value.type,
      format: uploadData.value.file.name.split('.').pop() || 'txt',
      file: uploadData.value.file,
    }
    await datasetStore.createDataset(form)
    uploadData.value = { name: '', description: '', type: '', file: null }
    showUploadDialog.value = false
  } catch (error) {
    console.error('Upload failed:', error)
  }
}

onMounted(() => {
  datasetStore.fetchDatasets()
})
</script>
