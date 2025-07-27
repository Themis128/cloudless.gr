<template>
  <div>
    <LayoutPageStructure
      title="LLM Models"
      subtitle="Manage and monitor your trained language models"
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
                <v-icon size="48" color="primary" class="mb-2"> mdi-brain </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ models.length }}
                </div>
                <div class="text-body-2">Total Models</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-2"> mdi-check-circle </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ readyModels }}
                </div>
                <div class="text-body-2">Ready Models</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="warning" class="mb-2"> mdi-clock </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ modelsInTraining }}
                </div>
                <div class="text-body-2">Training</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-2"> mdi-rocket </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ deployedModels }}
                </div>
                <div class="text-body-2">Deployed</div>
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
                  label="Search Models"
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
                  @click="createModel"
                >
                  Create Model
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Models Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary"> mdi-brain </v-icon>
              Language Models
            </div>
            <v-chip color="info"> {{ filteredModels.length }} of {{ models.length }} </v-chip>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="headers"
              :items="filteredModels"
              :search="searchQuery"
              :loading="loading"
              class="elevation-0"
              :items-per-page="10"
              :items-per-page-options="[5, 10, 25, 50]"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2"> mdi-brain </v-icon>
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
                <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
                  {{ item.status }}
                </v-chip>
              </template>

              <template #item.accuracy="{ item }">
                <div class="d-flex align-center">
                  <v-progress-linear
                    :model-value="item.accuracy"
                    color="success"
                    height="6"
                    rounded
                    class="mr-2"
                    style="width: 60px"
                  />
                  <span class="text-caption">{{ item.accuracy }}%</span>
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
                    @click="() => viewModel(item)"
                  />
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    color="warning"
                    @click="() => editModel(item)"
                  />
                  <v-btn
                    icon="mdi-play-circle"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => testModel(item)"
                  />
                  <v-btn
                    icon="mdi-rocket-launch"
                    size="small"
                    variant="text"
                    color="info"
                    @click="() => deployModel(item)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => deleteModel(item)"
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
              <v-icon start color="error"> mdi-alert-circle </v-icon>
              Confirm Deletion
            </v-card-title>
            <v-card-text>
              Are you sure you want to delete the model "{{ modelToDelete?.name }}"? This action
              cannot be undone.
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="grey" variant="text" @click="showDeleteDialog = false"> Cancel </v-btn>
              <v-btn color="error" variant="elevated" @click="confirmDelete"> Delete </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </template>

      <template #sidebar>
        <LLMGuide page="models" />
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
  const modelToDelete = ref(null)

  // Mock data - replace with actual API calls
  const models = ref([
    {
      id: '1',
      name: 'GPT-4 Fine-tuned',
      description: 'Customer support model fine-tuned on support conversations',
      type: 'text-generation',
      status: 'ready',
      accuracy: 94,
      created_at: '2024-01-15',
      base_model: 'gpt-4',
      parameters: { epochs: 10, batch_size: 32 },
    },
    {
      id: '2',
      name: 'BERT Classification',
      description: 'Text classification model for sentiment analysis',
      type: 'text-classification',
      status: 'training',
      accuracy: 87,
      created_at: '2024-01-20',
      base_model: 'bert-base-uncased',
      parameters: { epochs: 5, batch_size: 16 },
    },
    {
      id: '3',
      name: 'T5 Summarization',
      description: 'Text summarization model for document processing',
      type: 'text-generation',
      status: 'ready',
      accuracy: 91,
      created_at: '2024-01-18',
      base_model: 't5-base',
      parameters: { epochs: 8, batch_size: 8 },
    },
    {
      id: '4',
      name: 'RoBERTa QA',
      description: 'Question answering model for knowledge base queries',
      type: 'question-answering',
      status: 'deployed',
      accuracy: 89,
      created_at: '2024-01-12',
      base_model: 'roberta-base',
      parameters: { epochs: 12, batch_size: 16 },
    },
  ])

  // Computed properties
  const readyModels = computed(() => models.value.filter(model => model.status === 'ready').length)
  const modelsInTraining = computed(
    () => models.value.filter(model => model.status === 'training').length
  )
  const deployedModels = computed(
    () => models.value.filter(model => model.status === 'deployed').length
  )

  const filteredModels = computed(() => {
    let filtered = models.value

    if (statusFilter.value) {
      filtered = filtered.filter(model => model.status === statusFilter.value)
    }

    return filtered
  })

  // Table headers
  const headers = [
    { title: 'Model', key: 'name', sortable: true },
    { title: 'Type', key: 'type', sortable: true },
    { title: 'Status', key: 'status', sortable: true },
    { title: 'Accuracy', key: 'accuracy', sortable: true },
    { title: 'Created', key: 'created_at', sortable: true },
    { title: 'Actions', key: 'actions', sortable: false },
  ]

  // Filter options
  const statusFilters = [
    { title: 'Ready', value: 'ready' },
    { title: 'Training', value: 'training' },
    { title: 'Deployed', value: 'deployed' },
    { title: 'Error', value: 'error' },
  ]

  // Methods
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'success'
      case 'training':
        return 'warning'
      case 'deployed':
        return 'info'
      case 'error':
        return 'error'
      default:
        return 'grey'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString()
  }

  const createModel = () => {
    router.push('/llm/train')
  }

  const viewModel = (model: any) => {
    router.push(`/llm/models/${model.id}`)
  }

  const editModel = (model: any) => {
    router.push(`/llm/models/${model.id}/edit`)
  }

  const testModel = (model: any) => {
    router.push(`/llm/models/${model.id}/test`)
  }

  const deployModel = (model: any) => {
    router.push(`/llm/deployments/create?model=${model.id}`)
  }

  const deleteModel = (model: any) => {
    modelToDelete.value = model
    showDeleteDialog.value = true
  }

  const confirmDelete = () => {
    if (modelToDelete.value) {
      // In a real app, this would delete from the API
      models.value = models.value.filter(model => model.id !== modelToDelete.value.id)
      showDeleteDialog.value = false
      modelToDelete.value = null
    }
  }

  onMounted(() => {
    // Load models from API
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
