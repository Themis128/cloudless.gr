<template>
  <v-app>
    <v-navigation-drawer
      v-model="drawer"
      permanent
      class="pipeline-sidebar"
      width="280"
    >
      <!-- Sidebar Header -->
      <v-card-title class="text-h6 font-weight-bold pa-4">
        <v-icon start color="primary" class="mr-2">mdi-pipe</v-icon>
        Pipeline Management
      </v-card-title>

      <!-- Sidebar Navigation -->
      <v-list class="pa-2">
        <v-list-item
          to="/pipelines"
          prepend-icon="mdi-view-dashboard"
          title="Overview"
          variant="text"
        />
        <v-list-item
          to="/pipelines/create"
          prepend-icon="mdi-plus"
          title="Create Pipeline"
          variant="text"
        />
        <v-list-item
          to="/pipelines/analytics"
          prepend-icon="mdi-chart-line"
          title="Analytics"
          variant="text"
        />
        <v-list-item
          to="/pipelines/templates"
          prepend-icon="mdi-file-document"
          title="Templates"
          variant="text"
        />
        <v-list-item
          to="/pipelines/settings"
          prepend-icon="mdi-cog"
          title="Settings"
          variant="text"
        />
      </v-list>

      <!-- Quick Actions -->
      <v-card-actions class="pa-4">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          New Pipeline
        </v-btn>
      </v-card-actions>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main class="pipeline-main">
      <v-container fluid class="pa-4">
        <slot />
      </v-container>
    </v-main>

    <!-- Pipeline Status Bar -->
    <v-footer class="pipeline-status-bar">
      <v-container fluid>
        <v-row align="center" justify="space-between" no-gutters>
          <v-col cols="auto">
            <v-row align="center" no-gutters>
              <v-chip
                color="success"
                variant="outlined"
                size="small"
                class="mr-4"
                prepend-icon="mdi-check-circle"
              >
                {{ pipelineStats.active }} Active
              </v-chip>
              <v-chip
                color="info"
                variant="outlined"
                size="small"
                class="mr-4"
                prepend-icon="mdi-play-circle"
              >
                {{ pipelineStats.running }} Running
              </v-chip>
              <v-chip
                color="warning"
                variant="outlined"
                size="small"
                prepend-icon="mdi-pencil"
              >
                {{ pipelineStats.draft }} Draft
              </v-chip>
            </v-row>
          </v-col>

          <v-col cols="auto" v-if="isAnyExecuting">
            <v-row align="center" no-gutters>
              <v-progress-circular
                indeterminate
                size="20"
                color="primary"
                class="mr-2"
              />
              <v-chip color="primary" variant="outlined" size="small">
                {{ executingCount }} executing
              </v-chip>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>

    <!-- Create Pipeline Dialog -->
    <PipelinesStepperPipelineBuilder
      v-model="showCreateDialog"
      @pipeline-created="handlePipelineCreated"
    />
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'
import { usePipelineAnalytics } from '~/composables/usePipelineAnalytics'
import { usePipelineExecution } from '~/composables/usePipelineExecution'

const pipelineStore = usePipelineStore()
const { pipelineStats } = usePipelineAnalytics()
const { isAnyExecuting, executingCount } = usePipelineExecution()

const drawer = ref(true)
const showCreateDialog = ref(false)

const handlePipelineCreated = (pipeline: any) => {
  showCreateDialog.value = false
  // Navigate to the new pipeline
  navigateTo(`/pipelines/${pipeline.id}`)
}
</script>

<style scoped>
.pipeline-sidebar {
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
}

.pipeline-main {
  background: white;
}

.pipeline-status-bar {
  background: white;
  border-top: 1px solid #e9ecef;
  height: 60px;
}

@media (max-width: 1024px) {
  .pipeline-sidebar {
    position: fixed;
    z-index: 1000;
  }
}
</style>
