<template>
  <div>
    <PageStructure
      :title="project?.name || 'Project Details'"
      :subtitle="project?.description || 'View and manage project details'"
      back-button-to="/projects"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">
            Loading project details...
          </p>
        </div>

        <!-- Project Not Found -->
        <div v-else-if="!project" class="text-center py-8">
          <v-icon size="64" color="error" class="mb-4">
            mdi-alert-circle
          </v-icon>
          <h2 class="text-h5 mb-2">
            Project Not Found
          </h2>
          <p class="text-body-1 mb-4">
            The project you're looking for doesn't exist or has been removed.
          </p>
          <v-btn color="primary" to="/projects">
            Back to Projects
          </v-btn>
        </div>

        <!-- Project Details -->
        <div v-else>
          <!-- Project Overview -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-folder-information
              </v-icon>
              Project Overview
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Name:</strong> {{ project.name }}
                  </div>
                  <div class="mb-4">
                    <strong>Description:</strong> {{ project.description || 'No description available' }}
                  </div>
                  <div class="mb-4">
                    <strong>Status:</strong>
                    <v-chip
                      :color="getStatusColor(project.status)"
                      size="small"
                      variant="tonal"
                      class="ml-2"
                    >
                      {{ project.status }}
                    </v-chip>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="mb-4">
                    <strong>Created:</strong> {{ formatDate(project.created_at) }}
                  </div>
                  <div class="mb-4">
                    <strong>Last Modified:</strong> {{ formatDate(project.updated_at || project.created_at) }}
                  </div>
                  <div class="mb-4">
                    <strong>Project ID:</strong> {{ project.id }}
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Components Overview -->
          <v-row class="mb-4">
            <v-col cols="12" md="4">
              <v-card class="component-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="primary" class="mb-2">
                    mdi-robot
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ project.bots?.length || 0 }}
                  </div>
                  <div class="text-body-2">
                    Bots
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="component-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="success" class="mb-2">
                    mdi-brain
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ project.models?.length || 0 }}
                  </div>
                  <div class="text-body-2">
                    Models
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="4">
              <v-card class="component-card">
                <v-card-text class="text-center">
                  <v-icon size="48" color="info" class="mb-2">
                    mdi-timeline
                  </v-icon>
                  <div class="text-h4 font-weight-bold">
                    {{ project.pipelines?.length || 0 }}
                  </div>
                  <div class="text-body-2">
                    Pipelines
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Quick Actions -->
          <v-card class="mb-4">
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-lightning-bolt
              </v-icon>
              Quick Actions
            </v-card-title>
            <v-card-text>
              <div class="d-flex gap-3 flex-wrap">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-play-circle"
                  variant="elevated"
                  size="large"
                  @click="testProject"
                >
                  Test Project
                </v-btn>
                <v-btn
                  color="warning"
                  prepend-icon="mdi-pencil"
                  variant="outlined"
                  size="large"
                  @click="editProject"
                >
                  Edit Project
                </v-btn>
                <v-btn
                  color="success"
                  prepend-icon="mdi-deploy"
                  variant="outlined"
                  size="large"
                  @click="deployProject"
                >
                  Deploy Project
                </v-btn>
                <v-btn
                  color="info"
                  prepend-icon="mdi-chart-line"
                  variant="outlined"
                  size="large"
                  @click="viewAnalytics"
                >
                  View Analytics
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <!-- Components List -->
          <v-card>
            <v-card-title class="text-h6">
              <v-icon start color="primary">
                mdi-puzzle
              </v-icon>
              Project Components
            </v-card-title>
            <v-card-text>
              <v-tabs v-model="activeTab" color="primary">
                <v-tab value="bots">
                  <v-icon start>
                    mdi-robot
                  </v-icon>
                  Bots ({{ project.bots?.length || 0 }})
                </v-tab>
                <v-tab value="models">
                  <v-icon start>
                    mdi-brain
                  </v-icon>
                  Models ({{ project.models?.length || 0 }})
                </v-tab>
                <v-tab value="pipelines">
                  <v-icon start>
                    mdi-timeline
                  </v-icon>
                  Pipelines ({{ project.pipelines?.length || 0 }})
                </v-tab>
              </v-tabs>

              <v-window v-model="activeTab" class="mt-4">
                <v-window-item value="bots">
                  <div v-if="project.bots?.length" class="components-list">
                    <v-card
                      v-for="bot in project.bots"
                      :key="bot.id"
                      class="mb-2"
                      variant="outlined"
                    >
                      <v-card-text class="d-flex align-center justify-space-between">
                        <div>
                          <div class="font-weight-medium">
                            {{ bot.name }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ bot.description }}
                          </div>
                        </div>
                        <v-btn
                          icon="mdi-eye"
                          size="small"
                          variant="text"
                          color="primary"
                        />
                      </v-card-text>
                    </v-card>
                  </div>
                  <div v-else class="text-center py-8">
                    <v-icon size="48" color="grey-lighten-1" class="mb-4">
                      mdi-robot-off
                    </v-icon>
                    <p>No bots in this project</p>
                    <v-btn color="primary" variant="outlined" class="mt-2">
                      Add Bot
                    </v-btn>
                  </div>
                </v-window-item>

                <v-window-item value="models">
                  <div v-if="project.models?.length" class="components-list">
                    <v-card
                      v-for="model in project.models"
                      :key="model.id"
                      class="mb-2"
                      variant="outlined"
                    >
                      <v-card-text class="d-flex align-center justify-space-between">
                        <div>
                          <div class="font-weight-medium">
                            {{ model.name }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ model.description }}
                          </div>
                        </div>
                        <v-btn
                          icon="mdi-eye"
                          size="small"
                          variant="text"
                          color="primary"
                        />
                      </v-card-text>
                    </v-card>
                  </div>
                  <div v-else class="text-center py-8">
                    <v-icon size="48" color="grey-lighten-1" class="mb-4">
                      mdi-brain-off
                    </v-icon>
                    <p>No models in this project</p>
                    <v-btn color="primary" variant="outlined" class="mt-2">
                      Add Model
                    </v-btn>
                  </div>
                </v-window-item>

                <v-window-item value="pipelines">
                  <div v-if="project.pipelines?.length" class="components-list">
                    <v-card
                      v-for="pipeline in project.pipelines"
                      :key="pipeline.id"
                      class="mb-2"
                      variant="outlined"
                    >
                      <v-card-text class="d-flex align-center justify-space-between">
                        <div>
                          <div class="font-weight-medium">
                            {{ pipeline.name }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {{ pipeline.description }}
                          </div>
                        </div>
                        <v-btn
                          icon="mdi-eye"
                          size="small"
                          variant="text"
                          color="primary"
                        />
                      </v-card-text>
                    </v-card>
                  </div>
                  <div v-else class="text-center py-8">
                    <v-icon size="48" color="grey-lighten-1" class="mb-4">
                      mdi-timeline-off
                    </v-icon>
                    <p>No pipelines in this project</p>
                    <v-btn color="primary" variant="outlined" class="mt-2">
                      Add Pipeline
                    </v-btn>
                  </div>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </div>
      </template>

      <template #sidebar>
        <ProjectGuide />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageStructure from '~/components/layout/LayoutPageStructure.vue'
import ProjectGuide from '~/components/step-guides/ProjectGuide.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const project = ref<any>(null)
const activeTab = ref('bots')

// Mock project data - in a real app, this would come from an API
const mockProjects = [
  {
    id: '1',
    name: 'AI Chatbot',
    description: 'Customer service chatbot with natural language processing',
    status: 'active',
    created_at: '2024-01-15',
    updated_at: '2024-01-20',
    bots: [
      { id: 1, name: 'Customer Support Bot', description: 'Handles customer inquiries' },
      { id: 2, name: 'Sales Assistant', description: 'Assists with sales queries' }
    ],
    models: [
      { id: 1, name: 'GPT-4 Model', description: 'Language model for responses' }
    ],
    pipelines: [
      { id: 1, name: 'Data Processing', description: 'Processes customer data' }
    ]
  },
  {
    id: '2',
    name: 'Data Pipeline',
    description: 'ETL pipeline for analytics and reporting',
    status: 'draft',
    created_at: '2024-01-20',
    updated_at: '2024-01-22',
    bots: [],
    models: [
      { id: 2, name: 'BERT Model', description: 'Text classification model' },
      { id: 3, name: 'Custom ML Model', description: 'Custom trained model' }
    ],
    pipelines: [
      { id: 2, name: 'ETL Pipeline', description: 'Extract, transform, load data' },
      { id: 3, name: 'Analytics Pipeline', description: 'Generate analytics reports' }
    ]
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'archived': return 'info'
    case 'deleted': return 'error'
    default: return 'grey'
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const testProject = () => {
  router.push(`/projects/test?project=${project.value?.id}`)
}

const editProject = () => {
  router.push(`/projects/${project.value?.id}/edit`)
}

const deployProject = () => {
  router.push(`/projects/${project.value?.id}/deploy`)
}

const viewAnalytics = () => {
  router.push(`/projects/${project.value?.id}/analytics`)
}

onMounted(async () => {
  const projectId = route.params.id as string
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Find project in mock data
  project.value = mockProjects.find(p => p.id === projectId) || null
  
  loading.value = false
})
</script>

<style scoped>
.component-card {
  transition: transform 0.2s ease;
}

.component-card:hover {
  transform: translateY(-2px);
}

.components-list {
  max-height: 400px;
  overflow-y: auto;
}

.gap-3 {
  gap: 1rem;
}
</style> 