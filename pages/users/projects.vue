<template>
  <v-container class="users-projects-page" fluid>
    <div class="page-header mb-6">
      <v-row align="center" class="mb-4">
        <v-col>
          <h1 class="text-h3 font-weight-bold primary--text">
            My Projects
          </h1>
          <p class="text-subtitle-1 mt-2">
            Manage and organize your development projects
          </p>
        </v-col>
        <v-col cols="auto">
          <v-btn
            color="primary"
            size="large"
            prepend-icon="mdi-plus"
            @click="createProject"
          >
            New Project
          </v-btn>
        </v-col>
      </v-row>
    </div>

    <!-- Quick Stats -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card class="stats-card text-center pa-4">
          <v-icon size="48" color="primary" class="mb-2">mdi-folder</v-icon>
          <h3 class="text-h4 font-weight-bold">{{ projects.length }}</h3>
          <p class="text-body-2">Total Projects</p>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="stats-card text-center pa-4">
          <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
          <h3 class="text-h4 font-weight-bold">{{ activeProjects }}</h3>
          <p class="text-body-2">Active</p>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="stats-card text-center pa-4">
          <v-icon size="48" color="warning" class="mb-2">mdi-pause-circle</v-icon>
          <h3 class="text-h4 font-weight-bold">{{ draftProjects }}</h3>
          <p class="text-body-2">Drafts</p>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card class="stats-card text-center pa-4">
          <v-icon size="48" color="info" class="mb-2">mdi-clock</v-icon>
          <h3 class="text-h4 font-weight-bold">{{ recentActivity }}</h3>
          <p class="text-body-2">Recent Activity</p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filter and Search -->
    <v-card class="mb-6 pa-4">
      <v-row align="center">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            label="Search projects..."
            variant="outlined"
            density="compact"
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="statusFilter"
            :items="statusOptions"
            label="Filter by status"
            variant="outlined"
            density="compact"
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="sortBy"
            :items="sortOptions"
            label="Sort by"
            variant="outlined"
            density="compact"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- Projects Grid -->
    <div v-if="filteredProjects.length > 0">
      <v-row>
        <v-col
          v-for="project in filteredProjects"
          :key="project.id"
          cols="12"
          md="6"
          lg="4"
        >
          <v-card
            class="project-card h-100"
            :class="getStatusClass(project.status)"
            @click="openProject(project)"
          >
            <v-card-title class="d-flex justify-space-between align-center">
              <span class="text-h6">{{ project.name }}</span>
              <v-chip
                :color="getStatusColor(project.status)"
                size="small"
                variant="flat"
              >
                {{ project.status }}
              </v-chip>
            </v-card-title>

            <v-card-subtitle v-if="project.description">
              {{ project.description }}
            </v-card-subtitle>

            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon size="small" class="mr-1">mdi-calendar</v-icon>
                <span class="text-caption">
                  Created {{ formatDate(project.created_at) }}
                </span>
              </div>
              <div v-if="project.updated_at" class="d-flex align-center mb-2">
                <v-icon size="small" class="mr-1">mdi-update</v-icon>
                <span class="text-caption">
                  Updated {{ formatDate(project.updated_at) }}
                </span>
              </div>
              <div v-if="project.technology" class="d-flex align-center">
                <v-icon size="small" class="mr-1">mdi-code-tags</v-icon>
                <span class="text-caption">{{ project.technology }}</span>
              </div>
            </v-card-text>

            <v-card-actions>
              <v-btn
                variant="text"
                color="primary"
                @click.stop="openProject(project)"
              >
                Open
              </v-btn>
              <v-btn
                variant="text"
                color="secondary"
                @click.stop="editProject(project)"
              >
                Edit
              </v-btn>
              <v-spacer />
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list>
                  <v-list-item @click="duplicateProject(project)">
                    <template #prepend>
                      <v-icon>mdi-content-copy</v-icon>
                    </template>
                    <v-list-item-title>Duplicate</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="archiveProject(project)">
                    <template #prepend>
                      <v-icon>mdi-archive</v-icon>
                    </template>
                    <v-list-item-title>Archive</v-list-item-title>
                  </v-list-item>
                  <v-divider />
                  <v-list-item class="text-error" @click="deleteProject(project)">
                    <template #prepend>
                      <v-icon color="error">mdi-delete</v-icon>
                    </template>
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Empty State -->
    <v-card v-else class="text-center pa-8">
      <v-icon size="96" color="grey-lighten-2" class="mb-4">
        mdi-folder-open-outline
      </v-icon>
      <h3 class="text-h5 mb-2">No Projects Found</h3>
      <p class="text-body-1 mb-4">
        {{ searchQuery || statusFilter ? 'No projects match your filters.' : 'Start building something amazing!' }}
      </p>
      <v-btn
        v-if="!searchQuery && !statusFilter"
        color="primary"
        size="large"
        prepend-icon="mdi-plus"
        @click="createProject"
      >
        Create Your First Project
      </v-btn>
      <v-btn
        v-else
        variant="text"
        @click="clearFilters"
      >
        Clear Filters
      </v-btn>
    </v-card>

    <!-- Project Dialog -->
    <v-dialog v-model="projectDialog" max-width="600">
      <v-card>
        <v-card-title>{{ isEditing ? 'Edit Project' : 'Create New Project' }}</v-card-title>
        <v-card-text>
          <v-form ref="projectForm" v-model="formValid">
            <v-text-field
              v-model="projectForm.name"
              label="Project Name"
              :rules="nameRules"
              variant="outlined"
              class="mb-3"
            />
            <v-textarea
              v-model="projectForm.description"
              label="Description"
              variant="outlined"
              rows="3"
              class="mb-3"
            />
            <v-select
              v-model="projectForm.technology"
              :items="technologyOptions"
              label="Technology"
              variant="outlined"
              class="mb-3"
            />
            <v-select
              v-model="projectForm.status"
              :items="statusOptions"
              label="Status"
              variant="outlined"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeProjectDialog">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!formValid"
            :loading="saving"
            @click="saveProject"
          >
            {{ isEditing ? 'Update' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-error">Delete Project</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ projectToDelete?.name }}"? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="confirmDeleteProject"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'user',
})

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'draft' | 'archived' | 'completed'
  technology?: string
  created_at: string
  updated_at?: string
}

const router = useRouter()

// State
const projects = ref<Project[]>([])
const searchQuery = ref('')
const statusFilter = ref<string | null>(null)
const sortBy = ref('updated_at')
const projectDialog = ref(false)
const deleteDialog = ref(false)
const isEditing = ref(false)
const formValid = ref(false)
const saving = ref(false)
const deleting = ref(false)
const projectToDelete = ref<Project | null>(null)

// Form data
const projectForm = ref({
  name: '',
  description: '',
  technology: '',
  status: 'draft'
})

// Options
const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Draft', value: 'draft' },
  { title: 'Completed', value: 'completed' },
  { title: 'Archived', value: 'archived' }
]

const sortOptions = [
  { title: 'Recently Updated', value: 'updated_at' },
  { title: 'Recently Created', value: 'created_at' },
  { title: 'Name A-Z', value: 'name_asc' },
  { title: 'Name Z-A', value: 'name_desc' }
]

const technologyOptions = [
  'Vue.js',
  'React',
  'Angular',
  'Node.js',
  'Python',
  'Java',
  'C#',
  'PHP',
  'Ruby',
  'Go',
  'Rust',
  'Other'
]

// Validation rules
const nameRules = [
  (v: string) => !!v || 'Project name is required',
  (v: string) => v.length >= 3 || 'Project name must be at least 3 characters'
]

// Computed properties
const filteredProjects = computed(() => {
  let filtered = [...projects.value]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.technology?.toLowerCase().includes(query)
    )
  }

  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(project => project.status === statusFilter.value)
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'name_asc':
        return a.name.localeCompare(b.name)
      case 'name_desc':
        return b.name.localeCompare(a.name)
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'updated_at':
      default:
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    }
  })

  return filtered
})

const activeProjects = computed(() => projects.value.filter(p => p.status === 'active').length)
const draftProjects = computed(() => projects.value.filter(p => p.status === 'draft').length)
const recentActivity = computed(() => {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return projects.value.filter(p => new Date(p.updated_at || p.created_at) > weekAgo).length
})

// Methods
const loadProjects = async () => {
  // Mock data for now - replace with actual API call
  projects.value = [
    {
      id: '1',
      name: 'E-commerce Platform',
      description: 'Modern e-commerce solution with Vue.js and Node.js',
      status: 'active',
      technology: 'Vue.js',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T14:30:00Z'
    },
    {
      id: '2',
      name: 'Mobile App Backend',
      description: 'REST API for mobile application',
      status: 'draft',
      technology: 'Node.js',
      created_at: '2024-01-10T09:00:00Z',
      updated_at: '2024-01-18T16:45:00Z'
    },
    {
      id: '3',
      name: 'Data Analytics Dashboard',
      description: 'Real-time analytics and reporting dashboard',
      status: 'completed',
      technology: 'Python',
      created_at: '2023-12-01T08:00:00Z',
      updated_at: '2024-01-05T12:00:00Z'
    }
  ]
}

const createProject = () => {
  isEditing.value = false
  projectForm.value = {
    name: '',
    description: '',
    technology: '',
    status: 'draft'
  }
  projectDialog.value = true
}

const editProject = (project: Project) => {
  isEditing.value = true
  projectForm.value = {
    name: project.name,
    description: project.description || '',
    technology: project.technology || '',
    status: project.status
  }
  projectDialog.value = true
}

const openProject = (project: Project) => {
  router.push(`/projects/${project.id}`)
}

const saveProject = async () => {
  if (!formValid.value) return

  saving.value = true
  try {
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (isEditing.value) {
      // Update existing project logic
      console.log('Updating project:', projectForm.value)
    } else {
      // Create new project logic
      console.log('Creating project:', projectForm.value)
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectForm.value.name,
        description: projectForm.value.description,
        status: projectForm.value.status as Project['status'],
        technology: projectForm.value.technology,
        created_at: new Date().toISOString()
      }
      projects.value.unshift(newProject)
    }
    
    closeProjectDialog()
  } catch (error) {
    console.error('Error saving project:', error)
  } finally {
    saving.value = false
  }
}

const closeProjectDialog = () => {
  projectDialog.value = false
  projectForm.value = {
    name: '',
    description: '',
    technology: '',
    status: 'draft'
  }
}

const duplicateProject = (project: Project) => {
  const duplicate: Project = {
    ...project,
    id: Date.now().toString(),
    name: `${project.name} (Copy)`,
    created_at: new Date().toISOString(),
    updated_at: undefined
  }
  projects.value.unshift(duplicate)
}

const archiveProject = async (project: Project) => {
  try {
    // Mock archive - replace with actual API call
    project.status = 'archived'
    project.updated_at = new Date().toISOString()
  } catch (error) {
    console.error('Error archiving project:', error)
  }
}

const deleteProject = (project: Project) => {
  projectToDelete.value = project
  deleteDialog.value = true
}

const confirmDeleteProject = async () => {
  if (!projectToDelete.value) return

  deleting.value = true
  try {
    // Mock delete - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value!.id)
    deleteDialog.value = false
    projectToDelete.value = null
  } catch (error) {
    console.error('Error deleting project:', error)
  } finally {
    deleting.value = false
  }
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = null
}

const getStatusColor = (status: Project['status']) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'completed': return 'info'
    case 'archived': return 'grey'
    default: return 'grey'
  }
}

const getStatusClass = (status: Project['status']) => {
  return `project-card--${status}`
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.users-projects-page {
  max-width: 1200px;
  margin: 0 auto;
}

.stats-card {
  transition: all 0.3s ease;
  cursor: default;
}

.stats-card:hover {
  transform: translateY(-4px);
}

.project-card {
  transition: all 0.3s ease;
  cursor: pointer;
}

.project-card:hover {
  transform: translateY(-4px);
}

.project-card--active {
  border-left: 4px solid rgb(var(--v-theme-success));
}

.project-card--draft {
  border-left: 4px solid rgb(var(--v-theme-warning));
}

.project-card--completed {
  border-left: 4px solid rgb(var(--v-theme-info));
}

.project-card--archived {
  border-left: 4px solid rgb(var(--v-theme-grey));
  opacity: 0.7;
}

/* Mobile responsiveness for projects page */
@media (max-width: 768px) {
  .users-projects-page {
    padding: 8px;
  }
  
  .stats-card,
  .project-card {
    margin-bottom: 12px;
  }
  
  .stats-card:hover,
  .project-card:hover {
    transform: none;
  }
}

@media (max-width: 480px) {
  .users-projects-page {
    padding: 4px;
  }
  
  /* Project dialog form improvements */
  :deep(.v-dialog .v-card) {
    margin: 8px;
    max-height: calc(100vh - 32px);
  }
  
  :deep(.v-text-field .v-field__input) {
    min-height: 48px;
  }
  
  :deep(.v-btn) {
    min-height: 44px;
    font-size: 0.9rem;
  }
  
  :deep(.v-card-title) {
    font-size: 1.3rem !important;
    padding: 12px 16px;
  }
  
  :deep(.v-card-text) {
    padding: 12px 16px;
  }
  
  :deep(.v-card-actions) {
    padding: 8px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  :deep(.v-card-actions .v-btn) {
    flex: 1 1 auto;
    min-width: 120px;
  }
  
  /* Stats cards mobile layout */
  .stats-card .v-icon {
    font-size: 2.5rem !important;
  }
  
  .stats-card h3 {
    font-size: 1.8rem !important;
  }
}

@media (max-width: 360px) {
  :deep(.v-card-title) {
    font-size: 1.2rem !important;
    padding: 10px 12px;
  }
  
  :deep(.v-card-text) {
    padding: 10px 12px;
  }
  
  :deep(.v-card-actions) {
    padding: 8px 12px;
  }
  
  .stats-card .v-icon {
    font-size: 2rem !important;
  }
  
  .stats-card h3 {
    font-size: 1.5rem !important;
  }
}
</style>
