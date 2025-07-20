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
          
          <div v-if="projects.length === 0" class="empty-state">
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
                    <h3>{{ project.name }}</h3>
                    <p>{{ project.description }}</p>
                  </div>
                  <div class="project-stats">
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-robot
                      </v-icon>
                      <span>{{ project.bots?.length || 0 }} Bots</span>
                    </div>
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-brain
                      </v-icon>
                      <span>{{ project.models?.length || 0 }} Models</span>
                    </div>
                    <div class="stat-item">
                      <v-icon size="20" color="primary">
                        mdi-timeline
                      </v-icon>
                      <span>{{ project.pipelines?.length || 0 }} Pipelines</span>
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

const projects = ref<
  Array<{
    id: number
    name: string
    description: string
    bots?: any[]
    models?: any[]
    pipelines?: any[]
  }>
>([])

const showCreate = ref(false)
const newProject = ref({ name: '', description: '' })

const handleCreateClick = () => {
  showCreate.value = true
}

const handleCancelClick = () => {
  showCreate.value = false
}

const createProject = () => {
  if (!newProject.value.name) return
  projects.value.push({
    id: Date.now(),
    name: newProject.value.name,
    description: newProject.value.description,
    bots: [],
    models: [],
    pipelines: [],
  })
  showCreate.value = false
  newProject.value = { name: '', description: '' }
}

const avgComponents = computed(() => {
  if (!projects.value.length) return 0
  const total = projects.value.reduce((sum, p) => {
    return sum + (p.bots?.length || 0) + (p.models?.length || 0) + (p.pipelines?.length || 0)
  }, 0)
  return Math.round(total / projects.value.length)
})

const chartOptions = computed(() => {
  if (!projects.value.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Bots', 'Models', 'Pipelines'] },
    xAxis: {
      type: 'category',
      data: projects.value.map(p => p.name),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Bots',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.bots?.length || 0),
      },
      {
        name: 'Models',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.models?.length || 0),
      },
      {
        name: 'Pipelines',
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: projects.value.map(p => p.pipelines?.length || 0),
      },
    ],
  }
})

onMounted(() => {
  // Placeholder: load projects from API/store in the future
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
