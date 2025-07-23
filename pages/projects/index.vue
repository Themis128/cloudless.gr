<template>
  <div class="projects-page">
    <div class="page-header">
      <h1>
        <v-icon size="32" class="mr-3">
          mdi-folder-multiple
        </v-icon>
        Projects
      </h1>
      <p class="subtitle">
        Group and manage your Bots, Models, and Pipelines as Projects
      </p>
    </div>

    <div class="content-container">
      <div class="projects-content">
        <!-- Quick Actions -->
        <v-card class="mb-4 bg-white">
          <v-card-title class="text-h6 quick-actions-title">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <div class="quick-actions-header">
              <div class="quick-actions-title">
                <p class="text-body-2 text-medium-emphasis quick-actions-description">
                  Create, test, or manage projects
                </p>
              </div>
              <div class="quick-actions-stats">
                <v-chip color="primary" class="mr-2">
                  Total: {{ projects.length }}
                </v-chip>
                <v-chip color="info">
                  Avg Components: {{ avgComponents }}
                </v-chip>
              </div>
            </div>
            <div class="quick-actions-buttons">
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                variant="elevated"
                class="action-btn"
                size="large"
                @click="handleCreateClick"
              >
                Create Project
              </v-btn>
              <v-btn
                to="/projects/test"
                color="info"
                prepend-icon="mdi-play-circle"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Test Project
              </v-btn>
              <v-btn
                to="/projects/manage"
                color="secondary"
                prepend-icon="mdi-folder-multiple"
                variant="outlined"
                class="action-btn"
                size="large"
              >
                Manage Projects
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <div class="projects-overview">
          <ProjectGuide />
          
          <!-- Loading State -->
          <div v-if="loading" class="loading-state">
            <v-card class="bg-white">
              <v-card-text class="text-center py-8">
                <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                <h3 class="mt-4">Loading Projects...</h3>
              </v-card-text>
            </v-card>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="error-state">
            <v-card class="bg-white">
              <v-card-text class="text-center py-8">
                <v-icon size="64" color="error" class="mb-4">
                  mdi-alert-circle
                </v-icon>
                <h3>Error Loading Projects</h3>
                <p class="text-medium-emphasis">{{ error }}</p>
                <v-btn color="primary" @click="fetchProjects" class="mt-4">
                  <v-icon start>mdi-refresh</v-icon>
                  Retry
                </v-btn>
              </v-card-text>
            </v-card>
          </div>
          
          <!-- Empty State -->
          <div v-else-if="projects.length === 0" class="empty-state">
            <v-card class="bg-white">
              <v-card-text class="text-center py-8">
                <div class="empty-icon">
                  <v-icon size="64" color="primary">
                    mdi-folder-plus
                  </v-icon>
                </div>
                <h2>No Projects Found</h2>
                <p>Create your first project to get started!</p>
                <v-btn color="primary" size="large" @click="handleCreateClick">
                  <v-icon start>
                    mdi-plus
                  </v-icon>
                  Create Your First Project
                </v-btn>
              </v-card-text>
            </v-card>
          </div>
          
          <!-- Projects List -->
          <div v-else class="projects-section">
            <v-card class="mb-4 bg-white">
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-chart-bar
                </v-icon>
                Project Overview
              </v-card-title>
              <v-card-text>
                <div class="chart-container">
                  <client-only>
                    <VChart
                      v-if="VChart"
                      :option="chartOptions"
                      autoresize
                      style="height: 320px"
                    />
                    <div v-else style="height: 320px; display: flex; align-items: center; justify-content: center; color: rgba(0,0,0,0.6);">
                      Loading chart...
                    </div>
                  </client-only>
                </div>
              </v-card-text>
            </v-card>
            
            <div class="projects-grid">
              <v-card
                v-for="project in projects"
                :key="project.id"
                class="bg-white"
                elevation="2"
                hover
              >
                <v-card-text>
                  <div class="project-header">
                    <h3>{{ project.project_name }}</h3>
                    <p>{{ project.description }}</p>
                  </div>
                  <div class="project-stats">
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-robot
                      </v-icon>
                      <span>{{ project.status === 'published' ? 1 : 0 }} Bots</span>
                    </div>
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-brain
                      </v-icon>
                      <span>{{ project.category === 'web-development' ? 1 : 0 }} Models</span>
                    </div>
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-timeline
                      </v-icon>
                      <span>{{ project.status === 'published' ? 1 : 0 }} Pipelines</span>
                    </div>
                  </div>
                  <div class="project-actions">
                    <v-btn color="primary" variant="outlined" :to="`/projects/${project.id}`">
                      View Project
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>
            
            <div class="create-project-section">
              <v-btn color="primary" size="large" @click="handleCreateClick">
                <v-icon start>
                  mdi-plus
                </v-icon>
                Create New Project
              </v-btn>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <v-dialog v-model="showCreate" max-width="500">
      <v-card class="bg-white">
        <v-card-title>Create Project</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newProject.name"
            label="Project Name"
            required
          />
          <v-textarea v-model="newProject.description" label="Description" />
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="createProject">
            Create
          </v-btn>
          <v-btn text @click="handleCancelClick">
            Cancel
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'

// Client-side only import for VChart
let VChart: any = null
if (process.client) {
  VChart = defineAsyncComponent(() => import('vue-echarts'))
}

interface Project {
  id: number
  project_name: string
  description: string
  status: string
  category: string
  featured: boolean
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    name: string
    email: string
  }
}

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')

const showCreate = ref(false)
const newProject = ref({ name: '', description: '' })

// Fetch projects from database
const fetchProjects = async () => {
  try {
    loading.value = true
    error.value = ''
    
    interface ApiResponse {
      success: boolean
      data: Project[]
      message?: string
    }
    
    const response = await $fetch<ApiResponse>('/api/prisma/projects')
    if (response.success) {
      projects.value = response.data || []
    } else {
      error.value = response.message || 'Failed to fetch projects'
    }
  } catch (err: any) {
    console.error('Error fetching projects:', err)
    error.value = err.message || 'Failed to load projects'
  } finally {
    loading.value = false
  }
}

const handleCreateClick = () => {
  showCreate.value = true
}

const handleCancelClick = () => {
  showCreate.value = false
}

const createProject = async () => {
  if (!newProject.value.name) return
  
  try {
    const projectData = {
      project_name: newProject.value.name,
      description: newProject.value.description,
      status: 'draft',
      category: 'other',
      featured: false
    }
    
    interface CreateResponse {
      success: boolean
      data: Project
      message?: string
    }
    
    const response = await $fetch<CreateResponse>('/api/prisma/projects', {
      method: 'POST',
      body: projectData
    })
    
    if (response.success) {
      projects.value.unshift(response.data)
      showCreate.value = false
      newProject.value = { name: '', description: '' }
    } else {
      error.value = response.message || 'Failed to create project'
    }
  } catch (err: any) {
    console.error('Error creating project:', err)
    error.value = err.message || 'Failed to create project'
  }
}

const avgComponents = computed(() => {
  if (!projects.value.length) return 0
  // For now, return a placeholder since we don't have component counts
  return Math.round(projects.value.length * 2.5)
})

const chartOptions = computed(() => {
  if (!projects.value.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Projects by Status', 'Projects by Category'] },
    xAxis: {
      type: 'category',
      data: projects.value.map(p => p.project_name),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Projects by Status',
        type: 'bar',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.status === 'published' ? 1 : 0),
      },
      {
        name: 'Projects by Category',
        type: 'bar',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.category === 'web-development' ? 1 : 0),
      },
    ],
  }
})

onMounted(() => {
  fetchProjects()
})
</script>

<style scoped>
.projects-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

.page-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: white !important;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtitle {
  font-size: 1.2rem;
  color: white !important;
  margin: 0;
}

.content-container {
  background: transparent;
  padding: 0;
}

.projects-content {
  max-width: 1000px;
  margin: 0 auto;
}

.quick-actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.quick-actions-description {
  color: black !important;
}

.quick-actions-title {
  color: black !important;
}

.quick-actions-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: center;
}

.projects-overview {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.loading-state, .error-state {
  text-align: center;
}

.empty-state {
  text-align: center;
}

.empty-icon {
  margin-bottom: 2rem;
}

.empty-state h2 {
  font-size: 1.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 1rem;
}

.empty-state p {
  font-size: 1.1rem;
  color: rgba(0, 0, 0, 0.7);
  margin-bottom: 2rem;
}

.projects-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.chart-container {
  border-radius: 12px;
  overflow: hidden;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 1.5rem;
}



.project-header {
  margin-bottom: 1.5rem;
}

.project-header h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
  margin-bottom: 0.5rem;
}

.project-header p {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0;
}

.project-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.7);
}

.project-actions {
  display: flex;
  justify-content: flex-end;
}

.create-project-section {
  text-align: center;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .projects-page {
    padding: 1rem;
  }

  .content-container {
    padding: 2rem;
  }

  .page-header h1 {
    font-size: 2rem;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }

  .quick-actions-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .quick-actions-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
