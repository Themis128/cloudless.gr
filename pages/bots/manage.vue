<template>
  <div>
    <PageStructure
      title="Manage Bots"
      subtitle="Bulk operations and advanced bot management"
      back-button-to="/bots"
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
                  mdi-robot
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ bots.length }}
                </div>
                <div class="text-body-2">
                  Total Bots
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
                  {{ activeBots }}
                </div>
                <div class="text-body-2">
                  Active Bots
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
                  {{ draftBots }}
                </div>
                <div class="text-body-2">
                  Draft Bots
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
                  {{ avgInteractions }}
                </div>
                <div class="text-body-2">
                  Avg Interactions
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
                  :disabled="!selectedBots.length || !bulkAction"
                  prepend-icon="mdi-play"
                  @click="executeBulkAction"
                >
                  Execute ({{ selectedBots.length }})
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
                  label="Search Bots"
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

        <!-- Bots Table -->
        <v-card>
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon start color="primary">
                mdi-table
              </v-icon>
              Bots Table
            </div>
            <v-chip color="info">
              {{ filteredBots.length }} of {{ bots.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <v-data-table
              v-model="selectedBots"
              :headers="headers"
              :items="filteredBots"
              :search="searchQuery"
              show-select
              item-key="id"
              class="elevation-1"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">
                    mdi-robot
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

              <template #item.type="{ item }">
                <v-chip size="small" color="info" variant="tonal">
                  {{ item.type || 'General' }}
                </v-chip>
              </template>

              <template #item.interactions="{ item }">
                <div class="text-body-2">
                  {{ item.interactions || 0 }}
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
                    @click="() => viewBot(item)"
                  />
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    color="warning"
                    @click="() => editBot(item)"
                  />
                  <v-btn
                    icon="mdi-play-circle"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => testBot(item)"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="() => deleteBot(item)"
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
              Are you sure you want to delete the bot "{{ botToDelete?.name }}"? This action cannot be undone.
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="grey"
                variant="text"
                @click="cancelDelete"
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
        <BotGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageStructure from '~/components/layout/PageStructure.vue'
import BotGuide from '~/components/step-guides/BotGuide.vue'


const router = useRouter()

// Reactive data
const searchQuery = ref('')
const statusFilter = ref('')
const bulkAction = ref('')
const selectedBots = ref([])
const showDeleteDialog = ref(false)
const botToDelete = ref(null)

// Mock data - in a real app, this would come from the store
const bots = ref([
  {
    id: '1',
    name: 'Customer Support Bot',
    description: 'Handles customer inquiries and support requests',
    status: 'active',
    type: 'Support',
    interactions: 1250,
    created_at: '2024-01-15',
    model: 'GPT-4'
  },
  {
    id: '2',
    name: 'Sales Assistant',
    description: 'Assists with sales queries and lead qualification',
    status: 'active',
    type: 'Sales',
    interactions: 890,
    created_at: '2024-01-20',
    model: 'Claude-3'
  },
  {
    id: '3',
    name: 'FAQ Bot',
    description: 'Answers frequently asked questions',
    status: 'draft',
    type: 'Support',
    interactions: 0,
    created_at: '2024-01-25',
    model: 'GPT-3.5'
  },
  {
    id: '4',
    name: 'Order Tracker',
    description: 'Tracks order status and provides updates',
    status: 'active',
    type: 'E-commerce',
    interactions: 567,
    created_at: '2024-01-18',
    model: 'GPT-4'
  }
])

// Computed properties
const activeBots = computed(() => bots.value.filter(bot => bot.status === 'active').length)
const draftBots = computed(() => bots.value.filter(bot => bot.status === 'draft').length)
const avgInteractions = computed(() => {
  const total = bots.value.reduce((sum, bot) => sum + (bot.interactions || 0), 0)
  return Math.round(total / bots.value.length)
})

const filteredBots = computed(() => {
  let filtered = bots.value

  if (statusFilter.value) {
    filtered = filtered.filter(bot => bot.status === statusFilter.value)
  }

  return filtered
})

// Table headers
const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Interactions', key: 'interactions', sortable: true },
  { title: 'Created', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Filter options
const statusFilters = [
  { title: 'Active', value: 'active' },
  { title: 'Draft', value: 'draft' },
  { title: 'Inactive', value: 'inactive' }
]

const bulkActions = [
  { title: 'Activate Selected', value: 'activate' },
  { title: 'Deactivate Selected', value: 'deactivate' },
  { title: 'Delete Selected', value: 'delete' },
  { title: 'Export Selected', value: 'export' }
]

// Methods
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'inactive': return 'grey'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const refreshData = () => {
  // In a real app, this would refresh from the API
      // Refreshing bot data...
}

const executeBulkAction = () => {
  if (!bulkAction.value || !selectedBots.value.length) return

      // Executing bulk action on selected bots
  
  // In a real app, this would execute the bulk action
  switch (bulkAction.value) {
    case 'activate':
      // Activating selected bots
      break
    case 'deactivate':
      // Deactivating selected bots
      break
    case 'delete':
      // Deleting selected bots
      break
    case 'export':
      // Exporting selected bots
      break
  }
}

const viewBot = (bot: any) => {
  router.push(`/bots/${bot.id}`)
}

const editBot = (bot: any) => {
  router.push(`/bots/${bot.id}/edit`)
}

const testBot = (bot: any) => {
  router.push(`/bots/${bot.id}/test`)
}

const deleteBot = (bot: any) => {
  botToDelete.value = bot
  showDeleteDialog.value = true
}

const cancelDelete = () => {
  showDeleteDialog.value = false
  botToDelete.value = null
}

const confirmDelete = () => {
  if (botToDelete.value) {
    // In a real app, this would delete from the API
    bots.value = bots.value.filter(bot => bot.id !== botToDelete.value.id)
    showDeleteDialog.value = false
    botToDelete.value = null
  }
}

onMounted(() => {
  // In a real app, this would fetch bots from the store
      // Loading bot management page...
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