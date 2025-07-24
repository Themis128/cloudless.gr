<template>
  <div>
    <!-- Pipeline List -->
    <v-card class="mb-6 bg-white">
      <v-card-title class="d-flex justify-space-between align-center">
        <div class="d-flex align-center">
          <v-icon start color="primary">
            mdi-pipe
          </v-icon>
          Your Pipelines
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="$emit('create-pipeline')"
        >
          Create Pipeline
        </v-btn>
      </v-card-title>
      <v-card-text>
        <!-- Loading State -->
        <div v-if="pipelineStore.isLoading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
          <p class="mt-2 text-body-2">Loading pipelines...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="pipelineStore.allPipelines.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-pipe-off</v-icon>
          <h3 class="text-h6 mb-2">No pipelines found</h3>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Get started by creating your first pipeline.
          </p>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="$emit('create-pipeline')"
          >
            Create Your First Pipeline
          </v-btn>
        </div>

        <!-- Pipeline Grid -->
        <v-row v-else>
          <v-col
            v-for="pipeline in pipelineStore.allPipelines"
            :key="pipeline.id"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card
              class="pipeline-card bg-white"
              @click="navigateTo(`/pipelines/${pipeline.id}`)"
            >
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-pipe
                </v-icon>
                {{ pipeline.name }}
              </v-card-title>
              <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  {{ pipeline.description || 'No description available' }}
                </p>
                <div class="d-flex align-center justify-space-between">
                  <v-chip
                    :color="getStatusColor(pipeline.status)"
                    size="small"
                    variant="tonal"
                  >
                    {{ pipeline.status }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis">
                    {{ formatDate(pipeline.createdAt) }}
                  </span>
                </div>
                <div class="mt-2">
                  <span class="text-caption text-medium-emphasis">
                    Steps: {{ stepsCount(pipeline) }}
                  </span>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { usePipelineStore } from '~/stores/pipelineStore'

const pipelineStore = usePipelineStore()

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString()
}

const stepsCount = (pipeline: any) => {
  try {
    const config = JSON.parse(pipeline.config)
    return config.steps && Array.isArray(config.steps)
      ? config.steps.length
      : 0
  } catch {
    return 0
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'running': return 'info'
    case 'completed': return 'primary'
    case 'error': return 'error'
    default: return 'grey'
  }
}

defineEmits(['create-pipeline'])
</script>

<style scoped>
.pipeline-card {
  transition: transform 0.2s ease-in-out;
  cursor: pointer;
}

.pipeline-card:hover {
  transform: translateY(-4px);
}
</style> 