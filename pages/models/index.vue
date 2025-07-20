<template>
  <div>
    <PageStructure
      title="Models"
      subtitle="Manage and deploy your trained AI models"
      back-button-to="/"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis">
                  Create, train, deploy, or test models
                </p>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                to="/models/create"
                color="primary"
                prepend-icon="mdi-plus"
                variant="elevated"
                class="action-btn"
                size="large"
              >
                Create Model
              </v-btn>
              <v-btn
                to="/models/train"
                color="secondary"
                prepend-icon="mdi-school"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Train Model
              </v-btn>
              <v-btn
                to="/models/deploy"
                color="success"
                prepend-icon="mdi-rocket-launch"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Deploy Model
              </v-btn>
              <v-btn
                to="/models/test"
                color="info"
                prepend-icon="mdi-play-circle"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Test Model
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Models List -->
        <v-card class="bg-white">
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-brain
              </v-icon>
              Available Models
              <v-chip
                v-if="models.length > 0"
                class="ml-2"
                color="primary"
                size="small"
              >
                {{ models.length }}
              </v-chip>
            </div>
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              placeholder="Search models..."
              density="compact"
              variant="outlined"
              hide-details
              class="search-field"
              style="max-width: 300px;"
            />
          </v-card-title>
          
          <v-card-text>
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-2 text-body-2">
                Loading models...
              </p>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredModels.length === 0" class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1" class="mb-4">
                mdi-brain-off
              </v-icon>
              <h3 class="text-h6 mb-2">
                No models found
              </h3>
              <p class="text-body-2 text-medium-emphasis mb-4">
                {{ searchQuery ? 'No models match your search.' : 'Get started by creating your first model.' }}
              </p>
              <v-btn
                v-if="!searchQuery"
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
                  v-for="model in filteredModels"
                  :key="model.id"
                  class="model-item mb-3"
                  rounded="lg"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="40">
                      <v-icon color="white">
                        {{ getModelIcon(model.type) }}
                      </v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="text-h6 font-weight-medium">
                    {{ model.name }}
                  </v-list-item-title>
                  
                  <v-list-item-subtitle class="mt-1">
                    <div class="d-flex align-center gap-4">
                      <span class="d-flex align-center">
                        <v-icon size="16" class="mr-1">mdi-tag</v-icon>
                        {{ model.type || 'Unknown Type' }}
                      </span>
                      <span class="d-flex align-center">
                        <v-icon size="16" class="mr-1">mdi-calendar</v-icon>
                        {{ formatDate(model.created_at) }}
                      </span>
                      <span class="d-flex align-center">
                        <v-icon size="16" class="mr-1">mdi-code-tags</v-icon>
                        v{{ model.version || '1.0.0' }}
                      </span>
                    </div>
                  </v-list-item-subtitle>

                  <template #append>
                    <div class="d-flex align-center gap-2">
                      <!-- Status Chip -->
                      <v-chip
                        :color="getStatusColor(model.status)"
                        size="small"
                        variant="tonal"
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
                            prepend-icon="mdi-play-circle"
                            @click="() => testModel(model)"
                          >
                            Test Model
                          </v-list-item>
                          <v-list-item
                            prepend-icon="mdi-rocket-launch"
                            @click="() => deployModel(model)"
                          >
                            Deploy Model
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
            </div>
          </v-card-text>
        </v-card>

        <!-- Error Alert -->
        <v-alert v-if="error" type="error" class="mt-4">
          {{ error }}
        </v-alert>
      </template>

      <template #sidebar>
        <ModelGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ModelGuide from '~/components/step-guides/ModelGuide.vue'
import { useSupabase } from '~/composables/supabase'

interface Model {
  id: string
  name: string
  type?: string
  status?: string
  version?: string
  created_at: string
  description?: string
  framework?: string
}

const supabase = useSupabase()
const loading = ref(false)
const models = ref<Model[]>([])
const searchQuery = ref('')
const error = ref<string | null>(null)

const filteredModels = computed(() => {
  if (!searchQuery.value) return models.value
  const query = searchQuery.value.toLowerCase()
  return models.value.filter(model => 
    model.name.toLowerCase().includes(query) ||
    (model.description && model.description.toLowerCase().includes(query)) ||
    (model.type && model.type.toLowerCase().includes(query))
  )
})

const getModelIcon = (type?: string) => {
  switch (type) {
    case 'text-classification': return 'mdi-text'
    case 'image-classification': return 'mdi-image'
    case 'object-detection': return 'mdi-target'
    case 'sentiment-analysis': return 'mdi-emoticon'
    case 'translation': return 'mdi-translate'
    case 'summarization': return 'mdi-text-box'
    default: return 'mdi-brain'
  }
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'training': return 'info'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const viewModel = (model: Model) => {
  // Navigate to model details page
      // Viewing model
}

const editModel = (model: Model) => {
  // Navigate to model edit page
      // Editing model
}

const testModel = (model: Model) => {
  // Navigate to model test page
      // Testing model
}

const deployModel = (model: Model) => {
  // Navigate to model deploy page
      // Deploying model
}

const deleteModel = (model: Model) => {
  // Delete model confirmation
  if (confirm(`Are you sure you want to delete "${model.name}"?`)) {
    // Deleting model
  }
}

onMounted(async () => {
  loading.value = true
  const { data, error: err } = await supabase.from('models').select('*')
  if (err) {
    error.value = err.message
  } else {
    models.value = data || []
  }
  loading.value = false
})
</script>

<style scoped>
.quick-actions-header {
  margin-bottom: 1.5rem;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.action-btn {
  min-height: 48px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

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

.gap-4 {
  gap: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .quick-actions-buttons {
    grid-template-columns: 1fr;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>
