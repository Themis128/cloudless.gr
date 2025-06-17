<template>
  <v-card class="ma-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-history</v-icon>
      Training History
    </v-card-title>
    
    <v-card-text>
      <v-data-table
        :headers="headers"
        :items="sessions"
        :loading="loading"
        class="elevation-1"
        :items-per-page="10"
        show-expand
      >
        <template #item.status="{ item }">
          <v-chip 
            :color="getStatusColor(item.status)" 
            size="small"
            variant="flat"
          >
            <v-icon start size="small">{{ getStatusIcon(item.status) }}</v-icon>
            {{ item.status.toUpperCase() }}
          </v-chip>
        </template>
        
        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        
        <template #item.duration="{ item }">
          {{ calculateDuration(item) }}
        </template>
        
        <template #item.metrics="{ item }">
          <div v-if="item.metrics">
            <div class="text-caption">
              Loss: {{ item.metrics.loss?.toFixed(4) ?? 'N/A' }}
            </div>
            <div class="text-caption">
              Acc: {{ item.metrics.accuracy ? (item.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A' }}
            </div>
          </div>
          <span v-else class="text-medium-emphasis">N/A</span>
        </template>
        
        <template #item.actions="{ item }">
          <v-btn
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="viewSession(item)"
          >
            <v-icon>mdi-eye</v-icon>
            <v-tooltip activator="parent">View Details</v-tooltip>
          </v-btn>
          
          <v-btn
            v-if="item.log_url"
            icon="mdi-text-box"
            size="small"
            variant="text"
            :href="item.log_url"
            target="_blank"
          >
            <v-icon>mdi-text-box</v-icon>
            <v-tooltip activator="parent">View Logs</v-tooltip>
          </v-btn>
          
          <v-btn
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="confirmDelete(item)"
          >
            <v-icon>mdi-delete</v-icon>
            <v-tooltip activator="parent">Delete Session</v-tooltip>
          </v-btn>
        </template>
        
        <template #expanded-row="{ item }">
          <tr>
            <td colspan="6" class="pa-4">
              <v-card variant="flat">
                <v-card-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <div class="text-h6 mb-2">Configuration</div>
                      <div class="text-body-2">
                        <strong>Model:</strong> {{ item.config?.model_type ?? 'N/A' }}<br>
                        <strong>Epochs:</strong> {{ item.config?.epochs ?? 'N/A' }}<br>
                        <strong>Batch Size:</strong> {{ item.config?.batch_size ?? 'N/A' }}<br>
                        <strong>Learning Rate:</strong> {{ item.config?.learning_rate ?? 'N/A' }}<br>
                        <strong>Optimizer:</strong> {{ item.config?.optimizer ?? 'N/A' }}
                      </div>
                    </v-col>
                    <v-col cols="12" md="6">
                      <div class="text-h6 mb-2">Final Metrics</div>
                      <div class="text-body-2">
                        <strong>Training Loss:</strong> {{ item.metrics?.loss?.toFixed(4) ?? 'N/A' }}<br>
                        <strong>Training Accuracy:</strong> {{ item.metrics?.accuracy ? (item.metrics.accuracy * 100).toFixed(2) + '%' : 'N/A' }}<br>
                        <strong>Validation Loss:</strong> {{ item.metrics?.val_loss?.toFixed(4) ?? 'N/A' }}<br>
                        <strong>Validation Accuracy:</strong> {{ item.metrics?.val_accuracy ? (item.metrics.val_accuracy * 100).toFixed(2) + '%' : 'N/A' }}
                      </div>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </td>
          </tr>
        </template>
        
        <template #no-data>
          <v-alert type="info" variant="tonal" class="ma-4">
            No training sessions found. Start a new training session to see history here.
          </v-alert>
        </template>
      </v-data-table>
    </v-card-text>
    
    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete this training session? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteSession">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface TrainingSession {
  id: string
  project_id: string
  status: string
  config?: Record<string, any>
  metrics?: Record<string, any>
  log_url?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

const props = defineProps<{
  sessions: TrainingSession[]
  loading?: boolean
}>()

const emit = defineEmits<{
  viewSession: [session: TrainingSession]
  deleteSession: [sessionId: string]
}>()

const deleteDialog = ref(false)
const sessionToDelete = ref<TrainingSession | null>(null)

const headers = [
  { title: 'ID', key: 'id', sortable: true },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Started', key: 'created_at', sortable: true },
  { title: 'Duration', key: 'duration' },
  { title: 'Metrics', key: 'metrics' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
]

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'running':
      return 'primary'
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'orange'
    default:
      return 'grey'
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'mdi-check-circle'
    case 'failed':
      return 'mdi-alert-circle'
    case 'running':
      return 'mdi-play-circle'
    case 'pending':
      return 'mdi-clock-outline'
    case 'cancelled':
      return 'mdi-stop-circle'
    default:
      return 'mdi-help-circle'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString()
}

function calculateDuration(session: TrainingSession) {
  const start = new Date(session.created_at)
  const end = session.completed_at ? new Date(session.completed_at) : new Date()
  const duration = end.getTime() - start.getTime()
  
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

function viewSession(session: TrainingSession) {
  emit('viewSession', session)
}

function confirmDelete(session: TrainingSession) {
  sessionToDelete.value = session
  deleteDialog.value = true
}

function deleteSession() {
  if (sessionToDelete.value) {
    emit('deleteSession', sessionToDelete.value.id)
    sessionToDelete.value = null
  }
  deleteDialog.value = false
}
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  background: linear-gradient(45deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 12px 12px 0 0;
}

.v-data-table {
  border-radius: 8px;
}
</style>
