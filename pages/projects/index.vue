<template>
  <v-container fluid class="projects-container">
    <v-row justify="center">
      <v-col cols="12" lg="10">
        <!-- Page Header -->
        <v-card class="glassmorphism-card mb-6" elevation="0">
          <v-card-text class="pa-6">
            <div class="d-flex align-center justify-space-between flex-wrap">
              <div>
                <h1 class="text-h4 font-weight-bold text-primary mb-2">
                  <v-icon size="32" class="mr-3">mdi-folder-multiple</v-icon>
                  Projects
                </h1>
                <p class="text-body-1 text-medium-emphasis">
                  Manage your AI projects and deployments
                </p>
              </div>
              <v-btn
                color="primary"
                size="large"
                prepend-icon="mdi-plus"
                class="glassmorphism-btn"
                :disabled="loading"
              >
                New Project
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Project Stats -->
        <v-row class="mb-6">
          <v-col cols="12" sm="6" md="3">
            <v-card class="glassmorphism-card text-center" elevation="0">
              <v-card-text class="pa-4">
                <v-icon size="48" color="primary" class="mb-2">mdi-folder</v-icon>
                <div class="text-h5 font-weight-bold">{{ projects.length }}</div>
                <div class="text-body-2 text-medium-emphasis">Total Projects</div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card class="glassmorphism-card text-center" elevation="0">
              <v-card-text class="pa-4">
                <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
                <div class="text-h5 font-weight-bold">{{ activeProjects }}</div>
                <div class="text-body-2 text-medium-emphasis">Active</div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card class="glassmorphism-card text-center" elevation="0">
              <v-card-text class="pa-4">
                <v-icon size="48" color="warning" class="mb-2">mdi-pause-circle</v-icon>
                <div class="text-h5 font-weight-bold">{{ pausedProjects }}</div>
                <div class="text-body-2 text-medium-emphasis">Paused</div>
              </v-card-text>
            </v-card>
          </v-col>
          
          <v-col cols="12" sm="6" md="3">
            <v-card class="glassmorphism-card text-center" elevation="0">
              <v-card-text class="pa-4">
                <v-icon size="48" color="info" class="mb-2">mdi-cloud-upload</v-icon>
                <div class="text-h5 font-weight-bold">{{ deployedProjects }}</div>
                <div class="text-body-2 text-medium-emphasis">Deployed</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Projects List -->
        <v-card class="glassmorphism-card" elevation="0">
          <v-card-title class="pa-6 pb-4">
            <div class="d-flex align-center justify-space-between w-100">
              <span class="text-h6">Your Projects</span>
              <v-text-field
                v-model="searchQuery"
                placeholder="Search projects..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                class="search-field"
                style="max-width: 300px;"
              ></v-text-field>
            </div>
          </v-card-title>
          
          <v-card-text class="pa-6 pt-0">
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-8">
              <v-progress-circular
                indeterminate
                color="primary"
                size="64"
              ></v-progress-circular>
              <p class="text-body-1 mt-4">Loading projects...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredProjects.length === 0" class="text-center py-12">
              <v-icon size="80" color="grey-lighten-1" class="mb-4">
                {{ searchQuery ? 'mdi-file-search-outline' : 'mdi-folder-plus-outline' }}
              </v-icon>
              <h3 class="text-h6 mb-3">
                {{ searchQuery ? 'No projects found' : 'No projects yet' }}
              </h3>
              <p class="text-body-2 text-medium-emphasis mb-6">
                {{ searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Create your first project to get started building AI agents'
                }}
              </p>
              <v-btn
                v-if="!searchQuery"
                color="primary"
                size="large"
                prepend-icon="mdi-plus"
                class="glassmorphism-btn"
              >
                Create Your First Project
              </v-btn>
            </div>

            <!-- Projects Grid -->
            <v-row v-else>
              <v-col
                v-for="project in filteredProjects"
                :key="project.id"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card
                  class="project-card glassmorphism-card"
                  elevation="0"
                  hover
                  :to="`/projects/${project.slug}`"
                >
                  <div class="project-header pa-4 pb-0">
                    <div class="d-flex align-center justify-space-between">
                      <v-avatar size="40" :color="project.color || 'primary'">
                        <v-icon color="white">{{ project.icon || 'mdi-folder' }}</v-icon>
                      </v-avatar>
                      <v-menu>
                        <template #activator="{ props }">
                          <v-btn
                            v-bind="props"
                            icon="mdi-dots-vertical"
                            variant="text"
                            size="small"
                            @click.stop
                          ></v-btn>
                        </template>
                        <v-list>
                          <v-list-item prepend-icon="mdi-pencil" title="Edit" />
                          <v-list-item prepend-icon="mdi-content-duplicate" title="Duplicate" />
                          <v-list-item prepend-icon="mdi-delete" title="Delete" />
                        </v-list>
                      </v-menu>
                    </div>
                  </div>
                  
                  <v-card-text class="pa-4">
                    <h3 class="text-h6 font-weight-medium mb-2">{{ project.name }}</h3>
                    <p class="text-body-2 text-medium-emphasis mb-3">
                      {{ project.description || 'No description available' }}
                    </p>
                    
                    <div class="d-flex align-center justify-space-between">
                      <v-chip
                        :color="getStatusColor(project.status)"
                        size="small"
                        variant="flat"
                      >
                        <v-icon start size="small">{{ getStatusIcon(project.status) }}</v-icon>
                        {{ project.status }}
                      </v-chip>
                      
                      <div class="text-caption text-medium-emphasis">
                        {{ formatDate(project.updatedAt) }}
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Projects require authentication
definePageMeta({
  // Note: Using the global auth middleware, remove explicit auth middleware
})

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'paused' | 'deployed' | 'error' | 'archived'
  slug: string
  icon?: string
  color?: string
  updatedAt: Date
}

const loading = ref(true)
const searchQuery = ref('')

// Mock data - replace with actual API calls
const projects = ref<Project[]>([
  {
    id: '1',
    name: 'Customer Support Bot',
    description: 'AI chatbot for handling customer inquiries',
    status: 'active',
    slug: 'customer-support-bot',
    icon: 'mdi-robot',
    color: 'blue',
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Content Generator',
    description: 'Automated content creation for marketing',
    status: 'paused',
    slug: 'content-generator',
    icon: 'mdi-text-box',
    color: 'purple',
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    name: 'Data Analyzer',
    description: 'Smart data analysis and reporting tool',
    status: 'deployed',
    slug: 'data-analyzer',
    icon: 'mdi-chart-line',
    color: 'green',
    updatedAt: new Date('2024-01-08'),
  },
])

// Computed properties
const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value
  
  return projects.value.filter((project: Project) =>
    project.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const activeProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'active').length
)

const pausedProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'paused').length
)

const deployedProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'deployed').length
)

// Methods
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'deployed': return 'info'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return 'mdi-play-circle'
    case 'paused': return 'mdi-pause-circle'
    case 'deployed': return 'mdi-cloud-check'
    case 'error': return 'mdi-alert-circle'
    default: return 'mdi-circle'
  }
}

const formatDate = (date: Date) => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

// Load projects on mount
onMounted(async () => {
  try {
    // TODO: Replace with actual API call
    // const { data } = await $fetch('/api/projects')
    // projects.value = data
    
    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 1000))
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    loading.value = false
  }
})

// Set page title
useHead({
  title: 'Projects - Cloudless.gr'
})
</script>

<style scoped>
.projects-container {
  padding-top: 2rem;
}

.glassmorphism-card {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.glassmorphism-card:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.glassmorphism-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glassmorphism-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.project-card {
  cursor: pointer;
  transition: all 0.3s ease;
  height: 100%;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

.project-header {
  position: relative;
}

.search-field :deep(.v-field) {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Ensure text is readable against the clouds background */
h1, h3, p, .v-chip {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Mobile optimizations */
@media (max-width: 599px) {
  .projects-container {
    padding-top: 1rem;
  }
  
  .project-card {
    margin-bottom: 1rem;
  }
  
  .search-field {
    max-width: 100% !important;
    margin-top: 1rem;
  }
}

/* Animation for cards on load */
.glassmorphism-card {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stagger animation for project cards */
.project-card:nth-child(1) { animation-delay: 0.1s; }
.project-card:nth-child(2) { animation-delay: 0.2s; }
.project-card:nth-child(3) { animation-delay: 0.3s; }
.project-card:nth-child(4) { animation-delay: 0.4s; }
.project-card:nth-child(5) { animation-delay: 0.5s; }
.project-card:nth-child(6) { animation-delay: 0.6s; }
</style>
