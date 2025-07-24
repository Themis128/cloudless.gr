<template>
  <div class="pipeline-layout">
    <!-- Pipeline Sidebar -->
    <aside class="pipeline-sidebar">
      <div class="sidebar-header">
        <h2 class="text-h6 font-weight-bold">
          <v-icon start color="primary">mdi-pipe</v-icon>
          Pipeline Management
        </h2>
      </div>
      
      <nav class="sidebar-nav">
        <v-list>
          <v-list-item
            to="/pipelines"
            prepend-icon="mdi-view-dashboard"
            title="Overview"
          />
          <v-list-item
            to="/pipelines/create"
            prepend-icon="mdi-plus"
            title="Create Pipeline"
          />
          <v-list-item
            to="/pipelines/analytics"
            prepend-icon="mdi-chart-line"
            title="Analytics"
          />
          <v-list-item
            to="/pipelines/templates"
            prepend-icon="mdi-file-document"
            title="Templates"
          />
          <v-list-item
            to="/pipelines/settings"
            prepend-icon="mdi-cog"
            title="Settings"
          />
        </v-list>
      </nav>
      
      <!-- Quick Actions -->
      <div class="sidebar-actions">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          New Pipeline
        </v-btn>
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="pipeline-main">
      <slot />
    </main>
    
    <!-- Pipeline Status Bar -->
    <div class="pipeline-status-bar">
      <div class="status-indicators">
        <div class="status-item">
          <v-icon size="16" color="success">mdi-check-circle</v-icon>
          <span class="status-text">{{ pipelineStats.active }} Active</span>
        </div>
        <div class="status-item">
          <v-icon size="16" color="info">mdi-play-circle</v-icon>
          <span class="status-text">{{ pipelineStats.running }} Running</span>
        </div>
        <div class="status-item">
          <v-icon size="16" color="warning">mdi-pencil</v-icon>
          <span class="status-text">{{ pipelineStats.draft }} Draft</span>
        </div>
      </div>
      
      <div class="execution-status" v-if="isAnyExecuting">
        <v-progress-circular
          indeterminate
          size="20"
          color="primary"
          class="mr-2"
        />
        <span class="status-text">{{ executingCount }} executing</span>
      </div>
    </div>
    
    <!-- Create Pipeline Dialog -->
    <PipelinesStepperPipelineBuilder
      v-model="showCreateDialog"
      @pipeline-created="handlePipelineCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'
import { usePipelineAnalytics } from '~/composables/usePipelineAnalytics'
import { usePipelineExecution } from '~/composables/usePipelineExecution'

const pipelineStore = usePipelineStore()
const { pipelineStats } = usePipelineAnalytics()
const { isAnyExecuting, executingCount } = usePipelineExecution()

const showCreateDialog = ref(false)

const handlePipelineCreated = (pipeline: any) => {
  showCreateDialog.value = false
  // Navigate to the new pipeline
  navigateTo(`/pipelines/${pipeline.id}`)
}
</script>

<style scoped>
.pipeline-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 1fr auto;
  height: 100vh;
  overflow: hidden;
}

.pipeline-sidebar {
  grid-row: 1 / 3;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.sidebar-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.sidebar-nav {
  flex: 1;
}

.sidebar-actions {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.pipeline-main {
  grid-column: 2;
  grid-row: 1;
  overflow-y: auto;
  padding: 2rem;
}

.pipeline-status-bar {
  grid-column: 2;
  grid-row: 2;
  background: white;
  border-top: 1px solid #e9ecef;
  padding: 0.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.status-indicators {
  display: flex;
  gap: 1.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.execution-status {
  display: flex;
  align-items: center;
}

.status-text {
  color: #6c757d;
  font-weight: 500;
}

@media (max-width: 1024px) {
  .pipeline-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .pipeline-sidebar {
    grid-column: 1;
    grid-row: 1;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
  
  .sidebar-header {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  
  .sidebar-nav {
    flex: 1;
  }
  
  .sidebar-actions {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
  
  .pipeline-main {
    grid-column: 1;
    grid-row: 2;
  }
  
  .pipeline-status-bar {
    grid-column: 1;
    grid-row: 3;
  }
}
</style> 