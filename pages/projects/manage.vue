<template>
  <div>
    <PageStructure
      title="Manage Projects"
      subtitle="Bulk operations and advanced project management"
      back-button-to="/projects"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Overview Dashboard -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card class="stats-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-2">
                  mdi-folder-multiple
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ projects.length }}
                </div>
                <div class="text-body-2">
                  Total Projects
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
                  {{ activeProjects }}
                </div>
                <div class="text-body-2">
                  Active Projects
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
                  {{ draftProjects }}
                </div>
                <div class="text-body-2">
                  Draft Projects
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
                  {{ avgComponents }}
                </div>
                <div class="text-body-2">
                  Avg Components
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Bulk Operations -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-cog-sync
            </v-icon>
            Bulk Operations
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="bulkAction"
                  :items="bulkActions"
                  label="Select Action"
                  variant="outlined"
                  prepend-icon="mdi-playlist-edit"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-btn
                  color="primary"
                  size="large"
                  :disabled="!selectedProjects.length || !bulkAction"
                  prepend-icon="mdi-play"
                  @click="executeBulkAction"
                >
                  Execute ({{ selectedProjects.length }})
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Search and Filters -->
        <v-card class="mb-4">
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="searchQuery"
                  label="Search Projects"
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
                  color="secondary"
                  variant="outlined"
                  prepend-icon="mdi-refresh"
                  @click="refreshData"
                >
                  Refresh
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Projects Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-table
              </v-icon>
              Projects Table
            </div>
            <v-chip color="info">
              {{ filteredProjects.length }} of {{ projects.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-data-table
              v-model="selectedProjects"
              :headers="headers"
              :items="filteredProjects"
              :search="searchQuery"
              show-select
              item-key="id"
              class="elevation-1"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">
                    mdi-folder
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

              <template #item.components="{ item }">
                <div class="d-flex gap-1">
                  <v-chip size="x-small" color="primary" variant="tonal">
                    {{ item.bots?.length || 0 }} Bots
                  </v-chip>
                  <v-chip size="x-small" color="success" variant="tonal">
                    {{ item.models?.length || 0 }} Models
                  </v-chip>
                  <v-chip size="x-small" color="info" variant="tonal">
                    {{ item.pipelines?.length || 0 }} Pipelines
                  </v-chip>
                </div>
              </template>

              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>

              <template #item.actions="{ item }">
                <div class="d-flex gap-1">
                  <v-btn
                    icon="mdi-eye"
                    size="small"
                    variant="text"
                    color="primary"
                    :to="`/projects/${item.id}`"
                  />
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    color="warning"
                    @click="() => editProject(item)"
                  />
                  <v-btn
                    icon="mdi-play-circle"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => testProject(item)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => deleteProject(item)"
                  />
                </div>
              </template>
            </v-data-table>
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
        <ProjectGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'

const projects = ref([
  {
    id: 1,
    name: 'AI Chatbot',
    description: 'Customer service chatbot',
    status: 'active',
    created_at: '2024-01-15',
    bots: [1, 2],
    models: [1],
    pipelines: [1]
  },
  {
    id: 2,
    name: 'Data Pipeline',
    description: 'ETL pipeline for analytics',
    status: 'draft',
    created_at: '2024-01-20',
    bots: [],
    models: [2, 3],
    pipelines: [2, 3]
  }
])

const selectedProjects = ref([])
const searchQuery = ref('')
const statusFilter = ref('')
const bulkAction = ref('')
const showConfirmDialog = ref(false)
const confirmMessage = ref('')
const pendingAction = ref<string | null>(null)

const bulkActions = [
  'Activate Projects',
  'Deactivate Projects',
  'Delete Projects',
  'Export Projects',
  'Archive Projects'
]

const statusFilters = [
  'active',
  'draft',
  'archived',
  'deleted'
]

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Status', key: 'status' },
  { title: 'Components', key: 'components' },
  { title: 'Created', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const activeProjects = computed(() => 
  projects.value.filter(p => p.status === 'active').length
)

const draftProjects = computed(() => 
  projects.value.filter(p => p.status === 'draft').length
)

const avgComponents = computed(() => {
  if (!projects.value.length) return 0
  const total = projects.value.reduce((sum, p) => {
    return sum + (p.bots?.length || 0) + (p.models?.length || 0) + (p.pipelines?.length || 0)
  }, 0)
  return Math.round(total / projects.value.length)
})

const filteredProjects = computed(() => {
  let filtered = projects.value
  
  if (statusFilter.value) {
    filtered = filtered.filter(p => p.status === statusFilter.value)
  }
  
  return filtered
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'archived': return 'info'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const executeBulkAction = () => {
  if (!bulkAction.value || !selectedProjects.value.length) return
  
  confirmMessage.value = `Are you sure you want to ${bulkAction.value.toLowerCase()} for ${selectedProjects.value.length} project(s)?`
  showConfirmDialog.value = true
  pendingAction.value = bulkAction.value
}

const confirmAction = () => {
  // Implement bulk action logic here
  showConfirmDialog.value = false
  selectedProjects.value = []
  bulkAction.value = ''
}

const refreshData = () => {
  // Implement refresh logic here
}

const editProject = (project: any) => {
  // Implement edit logic here
}

const testProject = (project: any) => {
  // Implement test logic here
}

const deleteProject = (project: any) => {
  confirmMessage.value = `Are you sure you want to delete "${project.name}"?`
  showConfirmDialog.value = true
  pendingAction.value = 'delete'
}

const cancelAction = () => {
  showConfirmDialog.value = false
}
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

/* Make all text black on manage page */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.text-body-2) {
  color: black !important;
}

:deep(.text-h4) {
  color: black !important;
}

:deep(.text-h6) {
  color: black !important;
}

:deep(.font-weight-medium) {
  color: black !important;
}

:deep(.text-caption) {
  color: rgba(0, 0, 0, 0.7) !important;
}

:deep(.text-medium-emphasis) {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Make dropdown and input text black */
:deep(.v-select .v-field__input) {
  color: black !important;
}

:deep(.v-select .v-field__input::placeholder) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-text-field .v-field__input) {
  color: black !important;
}

:deep(.v-text-field .v-field__input::placeholder) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-text-field .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}

:deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Additional dropdown styling for better coverage */
:deep(.v-select .v-field) {
  color: black !important;
}

:deep(.v-select .v-field__append) {
  color: black !important;
}

:deep(.v-select .v-field__prepend) {
  color: black !important;
}

:deep(.v-menu .v-list) {
  color: black !important;
}

:deep(.v-menu .v-list-item) {
  color: black !important;
}

:deep(.v-overlay .v-list-item-title) {
  color: black !important;
}

:deep(.v-overlay .v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.7) !important;
}

:deep(.v-select .v-field__field) {
  color: black !important;
}

/* Ensure all dropdown text is black */
:deep(.v-select) {
  color: black !important;
}

:deep(.v-select *) {
  color: black !important;
}

:deep(.v-menu) {
  color: black !important;
}

:deep(.v-menu *) {
  color: black !important;
}

:deep(.v-overlay) {
  color: black !important;
}

:deep(.v-overlay *) {
  color: black !important;
}

:deep(.v-list) {
  color: black !important;
}

:deep(.v-list *) {
  color: black !important;
}

:deep(.v-list-item) {
  color: black !important;
}

:deep(.v-list-item *) {
  color: black !important;
}

/* Specific styling for Select Action dropdown */
:deep(.v-select[label="Select Action"] .v-field__input) {
  color: black !important;
}

:deep(.v-select[label="Select Action"] .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-select[label="Select Action"] .v-field) {
  color: black !important;
}

:deep(.v-select[label="Select Action"] *) {
  color: black !important;
}

/* Make dropdown arrow icon black */
:deep(.v-select__menu-icon) {
  color: black !important;
}

:deep(.mdi-menu-down) {
  color: black !important;
}

:deep(.v-icon.v-select__menu-icon) {
  color: black !important;
}

/* Make bulk operations dropdown text black */
:deep(.v-card:has(.v-card-title:contains("Bulk Operations")) .v-select .v-field__input) {
  color: black !important;
}

:deep(.v-card:has(.v-card-title:contains("Bulk Operations")) .v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-card:has(.v-card-title:contains("Bulk Operations")) .v-select *) {
  color: black !important;
}

/* Alternative approach for bulk operations dropdown */
:deep(.v-card .v-card-title:contains("Bulk Operations") ~ .v-card-text .v-select .v-field__input) {
  color: black !important;
}

:deep(.v-card .v-card-title:contains("Bulk Operations") ~ .v-card-text .v-select .v-field__label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-card .v-card-title:contains("Bulk Operations") ~ .v-card-text .v-select *) {
  color: black !important;
}

/* Specific styling for Select Action dropdown text */
:deep(.v-select .v-field__input) {
  color: black !important;
}

:deep(.v-select .v-field__input input) {
  color: black !important;
}

:deep(.v-select .v-field-label) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-select .v-field-label--floating) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-select__selection-text) {
  color: black !important;
}

:deep(.v-select__selection) {
  color: black !important;
}

:deep(.v-input__prepend .v-icon) {
  color: black !important;
}

:deep(.v-field__append-inner .v-icon) {
  color: black !important;
}

/* Additional dropdown menu fixes */
:deep(.v-menu .v-list) {
  background: white !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
}

:deep(.v-overlay .v-list) {
  background: white !important;
  border: 1px solid rgba(0, 0, 0, 0.1) !important;
}

:deep(.v-list-item:hover) {
  background: rgba(0, 0, 0, 0.05) !important;
}

:deep(.v-list-item--active) {
  background: rgba(0, 0, 0, 0.1) !important;
  color: black !important;
}

:deep(.v-list-item--active .v-list-item-title) {
  color: black !important;
}

/* Make table text black */
:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

/* Make dialog text black */
:deep(.v-dialog .v-card-title) {
  color: black !important;
}

:deep(.v-dialog .v-card-text) {
  color: black !important;
}
</style> 