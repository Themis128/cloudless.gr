<template>
  <v-container class="py-6">
    <!-- Header Section -->
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold text-primary">
          <v-icon size="32" class="mr-2">mdi-brain</v-icon>
          ML Projects
        </h1>
        <p class="text-body-1 text-medium-emphasis mt-1">
          Manage your machine learning projects and models
        </p>      </div>
      <div class="d-flex gap-2">
        <v-btn
          variant="outlined"
          size="large"
          prepend-icon="mdi-refresh"
          :loading="loading"
          @click="retryLoad"
        >
          Refresh
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          elevation="3"
          @click="showCreateDialog = true"
        >
          New Project
        </v-btn>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12">
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
        width="6"
      />
      <div class="mt-4 text-h6">Loading projects...</div>
      <div class="text-body-2 text-medium-emphasis">
        Please wait while we fetch your projects
      </div>
    </div>

    <!-- Error state -->
    <v-alert
      v-if="error && !loading"
      type="error"
      variant="tonal"
      prominent
      closable
      class="mb-6"
      @click:close="clearError"
    >
      <template #title>Failed to load projects</template>
      <div class="mt-2">{{ error }}</div>
      <template #append>
        <v-btn
          variant="outlined"
          size="small"
          @click="retryLoad"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>

    <!-- Success state with projects -->
    <div v-if="!loading && !error">
      <!-- Statistics Cards -->
      <v-row v-if="projects.length > 0" class="mb-6">
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4" color="primary" variant="tonal">
            <v-card-text>
              <div class="text-h3 font-weight-bold text-primary">{{ projects.length }}</div>
              <div class="text-body-2">Total Projects</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4" color="success" variant="tonal">
            <v-card-text>
              <div class="text-h3 font-weight-bold text-success">{{ activeProjectsCount }}</div>
              <div class="text-body-2">Active Projects</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4" color="info" variant="tonal">
            <v-card-text>
              <div class="text-h3 font-weight-bold text-info">{{ deployedProjectsCount }}</div>
              <div class="text-body-2">Deployed Models</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="text-center pa-4" color="warning" variant="tonal">
            <v-card-text>
              <div class="text-h3 font-weight-bold text-warning">{{ trainingProjectsCount }}</div>
              <div class="text-body-2">In Training</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Projects Grid -->
      <v-row v-if="projects.length > 0">
        <v-col
          v-for="project in projects"
          :key="project.id"
          cols="12"
          md="6"
          lg="4"
        >          <v-card
          class="h-100 project-card"
          elevation="2"
          hover
          @click="navigateToProject(project.id)"
        >
          <!-- Project header with status indicator -->
          <div class="project-header" :class="`status-${project.status}`">
            <v-card-title class="pb-2 d-flex align-center">
              <v-icon :icon="getProjectIcon(project.type)" class="mr-2" />
              <div class="flex-grow-1">
                {{ project.name }}
              </div>
              <v-chip
                :color="getStatusColor(project.status)"
                size="x-small"
                class="ml-2"
              >
                {{ formatStatus(project.status) }}
              </v-chip>
            </v-card-title>
          </div>            <v-card-subtitle v-if="project.description" class="pb-3 text-body-2">
            {{ project.description }}
          </v-card-subtitle>

          <v-card-text class="pt-2">
            <!-- Project Type and Framework -->
            <div class="mb-3">
              <v-chip
                variant="outlined"
                size="small"
                prepend-icon="mdi-tag"
                class="me-2"
              >
                {{ formatProjectType(project.type) }}
              </v-chip>
            </div>

            <!-- Progress indicator for active projects -->
            <div v-if="project.status === 'training'" class="mb-3">
              <div class="d-flex align-center mb-1">
                <v-icon size="16" class="me-1" color="warning">mdi-clock-outline</v-icon>
                <span class="text-body-2">Training in progress...</span>
              </div>
              <v-progress-linear
                color="warning"
                indeterminate
                height="4"
                rounded
              />
            </div>

            <!-- Timestamps -->
            <div class="d-flex justify-space-between text-caption text-medium-emphasis">
              <div>
                <v-icon size="14" class="me-1">mdi-calendar-plus</v-icon>
                Created {{ formatDate(project.created_at) }}
              </div>
              <div>
                <v-icon size="14" class="me-1">mdi-update</v-icon>
                Updated {{ formatDate(project.updated_at) }}
              </div>
            </div></v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-btn
              variant="text"
              size="small"
              prepend-icon="mdi-pencil"
              @click.stop="editProject(project)"
            >
              Edit
            </v-btn>
            <v-spacer />
            <v-btn
              variant="text"
              size="small"
              color="error"
              prepend-icon="mdi-delete"
              @click.stop="confirmDelete(project)"
            >
              Delete
            </v-btn>
          </v-card-actions>
        </v-card>
        </v-col>
      </v-row>      <!-- Enhanced Empty state -->
      <v-card
        v-else
        variant="outlined"
        class="text-center py-16"
        elevation="0"
      >
        <v-card-text>
          <div class="mb-6">
            <v-icon size="120" color="primary" class="mb-4">mdi-brain</v-icon>
          </div>
          <div class="text-h5 font-weight-bold mb-2">Start Your ML Journey</div>
          <div class="text-body-1 text-medium-emphasis mb-6 mx-auto" style="max-width: 400px;">
            Create your first machine learning project to begin exploring the world of AI and data science
          </div>
          <v-btn
            color="primary"
            size="x-large"
            elevation="2"
            prepend-icon="mdi-plus"
            @click="showCreateDialog = true"
          >
            Create Your First Project
          </v-btn>

          <!-- Quick start tips -->
          <div class="mt-8 mx-auto" style="max-width: 600px;">
            <v-row class="text-left">
              <v-col cols="12" md="4">
                <div class="d-flex align-center mb-2">
                  <v-icon color="success" class="me-2">mdi-check-circle</v-icon>
                  <span class="font-weight-medium">Computer Vision</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Image classification, object detection
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="d-flex align-center mb-2">
                  <v-icon color="success" class="me-2">mdi-check-circle</v-icon>
                  <span class="font-weight-medium">Natural Language</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Text analysis, sentiment detection
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="d-flex align-center mb-2">
                  <v-icon color="success" class="me-2">mdi-check-circle</v-icon>
                  <span class="font-weight-medium">Predictive Models</span>
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Regression, time series forecasting
                </div>
              </v-col>
            </v-row>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <!-- Create Project Dialog -->
    <ProjectCreateDialog
      v-model="showCreateDialog"
      @created="onProjectCreated"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h5">
          <v-icon color="error" class="me-2">mdi-delete-alert</v-icon>
          Delete Project
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ projectToDelete?.name }}</strong>?
          <br><br>
          <v-alert type="warning" variant="tonal" class="mt-3">
            This action cannot be undone. All associated data will be permanently removed.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="cancelDelete"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="deleting"
            @click="executeDelete"
          >
            Delete Project
          </v-btn>
        </v-card-actions>      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Project } from '~/types/supabase'

definePageMeta({
  middleware: 'auth'
})

const projectsStore = useProjectsStore()
const router = useRouter()

// Reactive state
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const projectToDelete = ref<Project | null>(null)
const deleting = ref(false)

// Computed properties from store
const projects = computed(() => projectsStore.projects)
const loading = computed(() => projectsStore.loading)
const error = computed(() => projectsStore.error)

// Statistics computed properties
const activeProjectsCount = computed(() => {
  return projects.value.filter(p => p.status === 'active').length
})

const deployedProjectsCount = computed(() => {
  return projects.value.filter(p => p.status === 'deployed').length
})

const trainingProjectsCount = computed(() => {
  return projects.value.filter(p => p.status === 'training').length
})

// Navigation
const navigateToProject = (projectId: string) => {
  router.push(`/projects/${projectId}`)
}

// Project actions
const editProject = (project: Project) => {
  // Navigate to project edit page
  router.push(`/projects/${project.id}/config`)
}

const confirmDelete = (project: Project) => {
  projectToDelete.value = project
  showDeleteDialog.value = true
}

const cancelDelete = () => {
  projectToDelete.value = null
  showDeleteDialog.value = false
}

const executeDelete = async () => {
  if (!projectToDelete.value) return

  deleting.value = true
  try {
    await projectsStore.deleteProject(projectToDelete.value.id)
    showDeleteDialog.value = false
    projectToDelete.value = null
  } catch (error) {
    console.error('Failed to delete project:', error)
    // Error handling will be shown via the store
  } finally {
    deleting.value = false
  }
}

const onProjectCreated = () => {
  showCreateDialog.value = false
  // Projects will be automatically updated via the store
}

const clearError = () => {
  projectsStore.clearError()
}

const retryLoad = async () => {
  try {
    await projectsStore.fetchProjects()
  } catch (error) {
    console.error('Retry failed:', error)
  }
}

// Utility functions
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'active': 'success',
    'training': 'warning',
    'deployed': 'info',
    'error': 'error',
    'completed': 'primary',
    'draft': 'default'
  }
  return colors[status] || 'default'
}

const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatProjectType = (type: string) => {
  const types: Record<string, string> = {
    'cv': 'Computer Vision',
    'nlp': 'Natural Language',
    'regression': 'Regression',
    'recommendation': 'Recommendation',
    'time-series': 'Time Series',
    'custom': 'Custom'
  }
  return types[type] || type
}

const getProjectIcon = (type: string) => {
  const icons: Record<string, string> = {
    'cv': 'mdi-eye',
    'nlp': 'mdi-message-text',
    'regression': 'mdi-chart-line',
    'recommendation': 'mdi-star',
    'time-series': 'mdi-chart-timeline',
    'custom': 'mdi-cog'
  }
  return icons[type] || 'mdi-brain'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) {
    return 'Today'
  } else if (diffInDays === 1) {
    return 'Yesterday'
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// Load projects on mount
onMounted(async () => {
  try {
    await projectsStore.fetchProjects()
  } catch (error) {
    console.error('Failed to fetch projects:', error)
  }
})
</script>

<style scoped>
.project-card {
  transition: all 0.3s ease;
  cursor: pointer;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.project-card .v-card-title {
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}

/* Statistics cards animations */
.v-card.pa-4 {
  transition: transform 0.2s ease;
}

.v-card.pa-4:hover {
  transform: scale(1.02);
}

/* Empty state styling */
.text-center .v-icon {
  opacity: 0.7;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Loading state */
.v-progress-circular {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .project-card:hover {
    transform: none;
  }

  .d-flex.justify-space-between {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}
</style>
