<template>
  <v-container class="py-6">
    <div class="d-flex align-center justify-space-between mb-6">
      <h1 class="text-h4 font-weight-bold">ML Projects</h1>
      <v-btn 
        color="primary" 
        size="large"
        @click="showCreateDialog = true"
        prepend-icon="mdi-plus"
      >
        New Project
      </v-btn>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate size="64"></v-progress-circular>
      <div class="mt-4 text-body-1">Loading projects...</div>
    </div>

    <!-- Error state -->
    <v-alert
      v-if="error && !loading"
      type="error"
      variant="outlined"
      closable
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <!-- Projects grid -->
    <div v-if="!loading && !error">
      <v-row v-if="projects.length > 0">
        <v-col
          v-for="project in projects"
          :key="project.id"
          cols="12"
          md="6"
          lg="4"
        >
          <v-card
            class="h-100"
            elevation="2"
            hover
            @click="navigateToProject(project.id)"
          >
            <v-card-title class="pb-2">
              {{ project.name }}
            </v-card-title>
            <v-card-subtitle v-if="project.description">
              {{ project.description }}
            </v-card-subtitle>
            <v-card-text>
              <v-chip
                :color="getStatusColor(project.status)"
                size="small"
                class="mb-2"
              >
                {{ project.status }}
              </v-chip>
              <div class="text-caption text-medium-emphasis">
                {{ project.type }} • {{ formatDate(project.created_at) }}
              </div>
            </v-card-text>
            <v-card-actions>
              <v-btn 
                variant="text" 
                size="small"
                @click.stop="editProject(project)"
              >
                Edit
              </v-btn>
              <v-spacer></v-spacer>
              <v-btn
                variant="text"
                size="small"
                color="error"
                @click.stop="deleteProject(project.id)"
              >
                Delete
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Empty state -->
      <v-card v-else variant="outlined" class="text-center py-12">
        <v-card-text>
          <v-icon size="64" color="primary" class="mb-4">mdi-brain</v-icon>
          <div class="text-h6 mb-2">No projects yet</div>
          <div class="text-body-2 text-medium-emphasis mb-4">
            Create your first ML project to get started
          </div>
          <v-btn
            color="primary"
            size="large"
            @click="showCreateDialog = true"
          >
            Create Project
          </v-btn>
        </v-card-text>
      </v-card>
    </div>

    <!-- Create Project Dialog -->
    <ProjectCreateDialog
      v-model="showCreateDialog"
      @created="onProjectCreated"
    />
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

definePageMeta({
  middleware: 'auth'
})

const projectsStore = useProjectsStore()
const router = useRouter()

// Reactive state
const showCreateDialog = ref(false)

// Computed properties from store
const projects = computed(() => projectsStore.projects)
const loading = computed(() => projectsStore.loading)
const error = computed(() => projectsStore.error)

// Navigation
const navigateToProject = (projectId: string) => {
  router.push(`/projects/${projectId}`)
}

// Project actions
const editProject = (project: any) => {
  // Navigate to project edit page
  router.push(`/projects/${project.id}/config`)
}

const deleteProject = async (projectId: string) => {
  if (confirm('Are you sure you want to delete this project?')) {
    try {
      await projectsStore.deleteProject(projectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }
}

const onProjectCreated = () => {
  showCreateDialog.value = false
  // Projects will be automatically updated via the store
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
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
