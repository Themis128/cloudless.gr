<template>
  <v-card class="bg-white">
    <v-card-title class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon start color="primary">mdi-brain</v-icon>
        Available Models
        <v-chip v-if="modelStore.allModels.length" class="ml-2" color="primary" size="small">
          {{ modelStore.allModels.length }}
        </v-chip>
      </div>
      
      <!-- Enhanced Search and Filters -->
      <div class="d-flex align-center">
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search models..."
          density="compact"
          variant="outlined"
          hide-details
          class="search-field mr-4"
          style="max-width: 250px;"
          @update:model-value="debouncedSearch"
        />
        
        <v-select
          v-model="selectedType"
          :items="modelTypes"
          label="Type"
          density="compact"
          variant="outlined"
          hide-details
          class="mr-4"
          style="max-width: 150px;"
          @update:model-value="refreshData"
        />
        
        <v-select
          v-model="selectedStatus"
          :items="statusOptions"
          label="Status"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 120px;"
          @update:model-value="refreshData"
        />
      </div>
    </v-card-title>
    
    <v-card-text>
      <!-- Loading State -->
      <div v-if="modelStore.loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
        <p class="mt-2 text-body-2">Loading models...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="modelStore.error" class="text-center py-8">
        <v-icon size="64" color="error" class="mb-4">mdi-alert-circle</v-icon>
        <h3 class="text-h6 mb-2">Failed to load models</h3>
        <p class="text-body-2 text-medium-emphasis mb-4">{{ modelStore.error }}</p>
        <v-btn @click="refreshData" color="primary" prepend-icon="mdi-refresh">
          Try Again
        </v-btn>
      </div>

      <!-- Empty State -->
      <div v-else-if="!filteredModels.length" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-brain-off</v-icon>
        <h3 class="text-h6 mb-2">No models found</h3>
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{ searchQuery || selectedType || selectedStatus ? 'No models match your filters.' : 'Get started by creating your first model.' }}
        </p>
        <v-btn
          v-if="!searchQuery && !selectedType && !selectedStatus"
          to="/models/create"
          color="primary"
          prepend-icon="mdi-plus"
        >
          Create Your First Model
        </v-btn>
      </div>

      <!-- Models List -->
      <div v-else>
        <v-list class="models-list">
          <v-list-item
            v-for="model in paginatedModels"
            :key="model.id"
            class="model-item mb-3"
            rounded="lg"
          >
            <template #prepend>
              <v-avatar color="primary" size="40">
                <v-icon color="white">{{ getModelIcon(model.type) }}</v-icon>
              </v-avatar>
            </template>

            <v-list-item-title class="text-h6 font-weight-medium">
              {{ model.name }}
            </v-list-item-title>
            
            <v-list-item-subtitle class="mt-1">
              <div class="d-flex align-center">
                <span class="d-flex align-center mr-4">
                  <v-icon size="16" class="mr-1">mdi-tag</v-icon>
                  {{ model.type || 'Unknown Type' }}
                </span>
                <span class="d-flex align-center">
                  <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                  {{ formatDate(model.createdAt) }}
                </span>
                <span v-if="model.accuracy" class="d-flex align-center">
                  <v-icon size="16" class="mr-1">mdi-chart-line</v-icon>
                  {{ (model.accuracy * 100).toFixed(1) }}%
                </span>
              </div>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex align-center">
                <!-- Status Chip -->
                <v-chip
                  :color="getStatusColor(model.status)"
                  size="small"
                  variant="tonal"
                  class="mr-2"
                >
                  {{ model.status || 'draft' }}
                </v-chip>
                
                <!-- Action Menu -->
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                    />
                  </template>
                  <v-list>
                    <v-list-item
                      prepend-icon="mdi-eye"
                      @click="() => viewModel(model)"
                    >
                      View Details
                    </v-list-item>
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      @click="() => editModel(model)"
                    >
                      Edit Model
                    </v-list-item>
                    <v-list-item
                      v-if="model.status === 'ready'"
                      prepend-icon="mdi-play-circle"
                      @click="() => testModel(model)"
                    >
                      Test Model
                    </v-list-item>
                    <v-list-item
                      v-if="model.status === 'ready'"
                      prepend-icon="mdi-rocket-launch"
                      @click="() => deployModel(model)"
                    >
                      Deploy Model
                    </v-list-item>
                    <v-list-item
                      v-if="model.status === 'draft'"
                      prepend-icon="mdi-school"
                      @click="() => startTraining(model)"
                    >
                      Start Training
                    </v-list-item>
                    <v-list-item
                      prepend-icon="mdi-delete"
                      @click="() => deleteModel(model)"
                    >
                      Delete Model
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </template>
          </v-list-item>
        </v-list>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="handlePageChange"
          />
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useModelStore } from '~/stores/modelStore'

const modelStore = useModelStore()

// Reactive state
const searchQuery = ref('')
const selectedType = ref('')
const selectedStatus = ref('')
const currentPage = ref(1)
const itemsPerPage = 10

// Debounced search
const debouncedSearch = useDebounceFn(() => {
  currentPage.value = 1
}, 300)

// Model types and status options
const modelTypes = [
  { title: 'All Types', value: '' },
  { title: 'Text Classification', value: 'text-classification' },
  { title: 'Image Classification', value: 'image-classification' },
  { title: 'Object Detection', value: 'object-detection' },
  { title: 'Sentiment Analysis', value: 'sentiment-analysis' },
  { title: 'Translation', value: 'translation' },
  { title: 'Summarization', value: 'summarization' },
  { title: 'Regression', value: 'regression' },
  { title: 'Clustering', value: 'clustering' }
]

const statusOptions = [
  { title: 'All Status', value: '' },
  { title: 'Draft', value: 'draft' },
  { title: 'Training', value: 'training' },
  { title: 'Ready', value: 'ready' },
  { title: 'Deployed', value: 'deployed' },
  { title: 'Error', value: 'error' }
]

// Computed properties
const filteredModels = computed(() => {
  let models = modelStore.allModels

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    models = models.filter(model => 
      model.name.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query) ||
      model.type.toLowerCase().includes(query)
    )
  }

  // Filter by type
  if (selectedType.value) {
    models = models.filter(model => model.type === selectedType.value)
  }

  // Filter by status
  if (selectedStatus.value) {
    models = models.filter(model => model.status === selectedStatus.value)
  }

  return models
})

const totalPages = computed(() => Math.ceil(filteredModels.value.length / itemsPerPage))

const paginatedModels = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredModels.value.slice(start, end)
})

// Methods
const refreshData = () => {
  if (modelStore.allModels.length === 0) {
    modelStore.fetchAll()
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const getModelIcon = (type: string) => {
  switch (type) {
    case 'text-classification': return 'mdi-text'
    case 'image-classification': return 'mdi-image'
    case 'object-detection': return 'mdi-target'
    case 'sentiment-analysis': return 'mdi-emoticon'
    case 'translation': return 'mdi-translate'
    case 'summarization': return 'mdi-text-box'
    case 'regression': return 'mdi-chart-line'
    case 'clustering': return 'mdi-chart-bubble'
    default: return 'mdi-brain'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'success'
    case 'draft': return 'warning'
    case 'training': return 'info'
    case 'deployed': return 'primary'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString()
}

const viewModel = (model: any) => {
  navigateTo(`/models/${model.id}`)
}

const editModel = (model: any) => {
  navigateTo(`/models/${model.id}/edit`)
}

const testModel = (model: any) => {
  navigateTo(`/models/${model.id}/test`)
}

const deployModel = async (model: any) => {
  try {
    await modelStore.updateModel(model.id, { status: 'deploying' })
    // Add actual deployment logic here
  } catch (error) {
    console.error('Failed to deploy model:', error)
  }
}

const startTraining = async (model: any) => {
  try {
    await modelStore.updateModel(model.id, { status: 'training' })
    // Add actual training logic here
  } catch (error) {
    console.error('Failed to start training:', error)
  }
}

const deleteModel = async (model: any) => {
  if (confirm(`Are you sure you want to delete "${model.name}"?`)) {
    try {
      await modelStore.deleteModel(model.id)
    } catch (error) {
      console.error('Failed to delete model:', error)
    }
  }
}

onMounted(() => {
  if (modelStore.allModels.length === 0) {
    modelStore.fetchAll()
  }
})
</script>

<style scoped>
.models-list {
  background: transparent;
}

.model-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease-in-out;
}

.model-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}


</style> 