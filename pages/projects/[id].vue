<template>
  <v-container fluid class="project-detail-container">
    <v-row justify="center">
      <v-col cols="12" lg="10">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12">
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
          ></v-progress-circular>
          <p class="text-body-1 mt-4">Loading project details...</p>
        </div>

        <!-- Error State -->
        <v-card v-else-if="error" class="glassmorphism-card text-center" elevation="0">
          <v-card-text class="pa-8">
            <v-icon size="80" color="error" class="mb-4">mdi-alert-circle-outline</v-icon>
            <h2 class="text-h5 mb-4">Project Not Found</h2>
            <p class="text-body-1 mb-6">The project you're looking for doesn't exist or you don't have access to it.</p>
            <v-btn color="primary" to="/projects" prepend-icon="mdi-arrow-left">
              Back to Projects
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- Project Content -->
        <template v-else-if="project">
          <!-- Project Header -->
          <v-card class="glassmorphism-card mb-6" elevation="0">
            <v-card-text class="pa-6">
              <div class="d-flex align-center justify-space-between flex-wrap mb-4">
                <div class="d-flex align-center">
                  <v-btn
                    icon
                    variant="text"
                    to="/projects"
                    class="mr-3"
                    size="small"
                  >
                    <v-icon>mdi-arrow-left</v-icon>
                  </v-btn>
                  <v-avatar size="48" :color="project.color || 'primary'" class="mr-4">
                    <v-icon color="white" size="24">{{ project.icon || 'mdi-folder' }}</v-icon>
                  </v-avatar>
                  <div>
                    <h1 class="text-h4 font-weight-bold text-primary mb-1">
                      {{ project.name }}
                    </h1>
                    <p class="text-body-1 text-medium-emphasis">
                      {{ project.description || 'No description available' }}
                    </p>
                  </div>
                </div>
                
                <div class="d-flex align-center flex-wrap ga-2">
                  <v-chip
                    :color="getStatusColor(project.status)"
                    size="large"
                    variant="flat"
                  >
                    <v-icon start>{{ getStatusIcon(project.status) }}</v-icon>
                    {{ project.status }}
                  </v-chip>
                  
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon="mdi-dots-vertical"
                        variant="text"
                        class="glassmorphism-btn"
                      ></v-btn>
                    </template>
                    <v-list>
                      <v-list-item prepend-icon="mdi-pencil" title="Edit Project" />
                      <v-list-item prepend-icon="mdi-play" title="Deploy" />
                      <v-list-item prepend-icon="mdi-content-duplicate" title="Duplicate" />
                      <v-divider />
                      <v-list-item prepend-icon="mdi-delete" title="Delete" class="text-error" />
                    </v-list>
                  </v-menu>
                </div>
              </div>

              <!-- Project Stats -->
              <v-row>
                <v-col cols="6" sm="3">
                  <div class="text-center">
                    <div class="text-h6 font-weight-bold">{{ project.agents || 0 }}</div>
                    <div class="text-body-2 text-medium-emphasis">Agents</div>
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-center">
                    <div class="text-h6 font-weight-bold">{{ project.workflows || 0 }}</div>
                    <div class="text-body-2 text-medium-emphasis">Workflows</div>
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-center">
                    <div class="text-h6 font-weight-bold">{{ project.deployments || 0 }}</div>
                    <div class="text-body-2 text-medium-emphasis">Deployments</div>
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-center">
                    <div class="text-h6 font-weight-bold">{{ formatDate(project.updatedAt) }}</div>
                    <div class="text-body-2 text-medium-emphasis">Last Updated</div>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Project Tabs -->
          <v-card class="glassmorphism-card" elevation="0">
            <v-tabs v-model="activeTab" class="px-6">
              <v-tab value="overview">
                <v-icon start>mdi-view-dashboard</v-icon>
                Overview
              </v-tab>
              <v-tab value="agents">
                <v-icon start>mdi-robot</v-icon>
                Agents
              </v-tab>
              <v-tab value="workflows">
                <v-icon start>mdi-graph-outline</v-icon>
                Workflows
              </v-tab>
              <v-tab value="deployments">
                <v-icon start>mdi-cloud-upload</v-icon>
                Deployments
              </v-tab>
              <v-tab value="settings">
                <v-icon start>mdi-cog</v-icon>
                Settings
              </v-tab>
            </v-tabs>

            <v-card-text class="pa-6">
              <v-tabs-window v-model="activeTab">
                <!-- Overview Tab -->
                <v-tabs-window-item value="overview">
                  <v-row>
                    <v-col cols="12" md="8">
                      <h3 class="text-h6 mb-4">Project Description</h3>
                      <p class="text-body-1 mb-6">
                        {{ project.description || 'No detailed description available for this project.' }}
                      </p>
                      
                      <h3 class="text-h6 mb-4">Recent Activity</h3>
                      <v-timeline density="compact">
                        <v-timeline-item
                          v-for="activity in project.recentActivity || []"
                          :key="activity.id"
                          :dot-color="activity.type === 'success' ? 'success' : 'info'"
                          size="small"
                        >
                          <div class="d-flex justify-space-between align-center">
                            <div>
                              <strong>{{ activity.title }}</strong>
                              <div class="text-body-2 text-medium-emphasis">{{ activity.description }}</div>
                            </div>
                            <div class="text-caption text-medium-emphasis">
                              {{ formatDate(activity.timestamp) }}
                            </div>
                          </div>
                        </v-timeline-item>
                      </v-timeline>
                      
                      <div v-if="!project.recentActivity?.length" class="text-center py-8">
                        <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-timeline-clock-outline</v-icon>
                        <p class="text-body-2 text-medium-emphasis">No recent activity</p>
                      </div>
                    </v-col>
                    
                    <v-col cols="12" md="4">
                      <h3 class="text-h6 mb-4">Quick Actions</h3>
                      <v-list class="bg-transparent">
                        <v-list-item
                          prepend-icon="mdi-robot-excited"
                          title="Create Agent"
                          subtitle="Build a new AI agent"
                          class="glassmorphism-list-item"
                        />
                        <v-list-item
                          prepend-icon="mdi-workflow"
                          title="New Workflow"
                          subtitle="Design automation workflow"
                          class="glassmorphism-list-item"
                        />
                        <v-list-item
                          prepend-icon="mdi-cloud-upload"
                          title="Deploy Project"
                          subtitle="Push to production"
                          class="glassmorphism-list-item"
                        />
                        <v-list-item
                          prepend-icon="mdi-chart-line"
                          title="View Analytics"
                          subtitle="Performance metrics"
                          class="glassmorphism-list-item"
                        />
                      </v-list>
                    </v-col>
                  </v-row>
                </v-tabs-window-item>

                <!-- Agents Tab -->
                <v-tabs-window-item value="agents">
                  <div class="text-center py-12">
                    <v-icon size="80" color="grey-lighten-1" class="mb-4">mdi-robot-outline</v-icon>
                    <h3 class="text-h6 mb-3">No Agents Created</h3>
                    <p class="text-body-2 text-medium-emphasis mb-6">
                      Create your first AI agent to start automating tasks
                    </p>
                    <v-btn color="primary" size="large" prepend-icon="mdi-plus" class="glassmorphism-btn">
                      Create Agent
                    </v-btn>
                  </div>
                </v-tabs-window-item>

                <!-- Workflows Tab -->
                <v-tabs-window-item value="workflows">
                  <div class="text-center py-12">
                    <v-icon size="80" color="grey-lighten-1" class="mb-4">mdi-graph-outline</v-icon>
                    <h3 class="text-h6 mb-3">No Workflows Configured</h3>
                    <p class="text-body-2 text-medium-emphasis mb-6">
                      Build workflows to connect your agents and automate processes
                    </p>
                    <v-btn color="primary" size="large" prepend-icon="mdi-plus" class="glassmorphism-btn">
                      Create Workflow
                    </v-btn>
                  </div>
                </v-tabs-window-item>

                <!-- Deployments Tab -->
                <v-tabs-window-item value="deployments">
                  <div class="text-center py-12">
                    <v-icon size="80" color="grey-lighten-1" class="mb-4">mdi-cloud-outline</v-icon>
                    <h3 class="text-h6 mb-3">No Deployments</h3>
                    <p class="text-body-2 text-medium-emphasis mb-6">
                      Deploy your project to make it accessible to users
                    </p>
                    <v-btn color="primary" size="large" prepend-icon="mdi-cloud-upload" class="glassmorphism-btn">
                      Deploy Project
                    </v-btn>
                  </div>
                </v-tabs-window-item>

                <!-- Settings Tab -->
                <v-tabs-window-item value="settings">
                  <v-form>
                    <v-row>
                      <v-col cols="12" md="6">
                        <h3 class="text-h6 mb-4">General Settings</h3>
                        <v-text-field
                          v-model="project.name"
                          label="Project Name"
                          variant="outlined"
                          readonly
                        />
                        <v-textarea
                          v-model="project.description"
                          label="Description"
                          variant="outlined"
                          rows="3"
                          readonly
                        />
                        <v-select
                          v-model="project.status"
                          label="Status"
                          :items="['active', 'paused', 'deployed', 'archived']"
                          variant="outlined"
                          readonly
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <h3 class="text-h6 mb-4">Advanced Settings</h3>
                        <v-switch
                          v-model="project.settings.autoBackup"
                          label="Auto Backup"
                          color="primary"
                          disabled
                        />
                        <v-switch
                          v-model="project.settings.notifications"
                          label="Email Notifications"
                          color="primary"
                          disabled
                        />
                        <v-switch
                          v-model="project.settings.analytics"
                          label="Analytics Tracking"
                          color="primary"
                          disabled
                        />
                      </v-col>
                    </v-row>
                  </v-form>
                </v-tabs-window-item>
              </v-tabs-window>
            </v-card-text>
          </v-card>
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Projects require authentication
definePageMeta({
  // Note: Using the global auth middleware, remove explicit auth middleware
})

interface ProjectActivity {
  id: string
  title: string
  description: string
  type: 'success' | 'info' | 'warning' | 'error'
  timestamp: Date
}

interface ProjectSettings {
  autoBackup: boolean
  notifications: boolean
  analytics: boolean
}

interface Project {
  id: string
  name: string
  description?: string
  status: 'active' | 'paused' | 'deployed' | 'archived' | 'error'
  icon?: string
  color?: string
  agents?: number
  workflows?: number
  deployments?: number
  updatedAt: Date
  settings: ProjectSettings
  recentActivity?: ProjectActivity[]
}

const route = useRoute()
const loading = ref(true)
const error = ref(false)
const activeTab = ref('overview')

// Mock project data - replace with actual API call
const project = ref<any>(null)

// Methods
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'deployed': return 'info'
    case 'archived': return 'grey'
    case 'error': return 'error'
    default: return 'grey'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return 'mdi-play-circle'
    case 'paused': return 'mdi-pause-circle'
    case 'deployed': return 'mdi-cloud-check'
    case 'archived': return 'mdi-archive'
    case 'error': return 'mdi-alert-circle'
    default: return 'mdi-circle'
  }
}

const formatDate = (date: Date | string) => {
  const d = new Date(date)
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

// Load project data
onMounted(async () => {
  try {
    const projectId = route.params.id as string
    
    // TODO: Replace with actual API call
    // const { data } = await $fetch(`/api/projects/${projectId}`)
    // project.value = data
    
    // Mock data for demonstration
    const mockProjects: Record<string, any> = {
      'customer-support-bot': {
        id: '1',
        name: 'Customer Support Bot',
        description: 'AI-powered chatbot designed to handle customer inquiries, provide instant responses, and escalate complex issues to human agents when necessary.',
        status: 'active',
        icon: 'mdi-robot',
        color: 'blue',
        agents: 3,
        workflows: 2,
        deployments: 1,
        updatedAt: new Date('2024-01-15'),
        settings: {
          autoBackup: true,
          notifications: true,
          analytics: false
        },
        recentActivity: [
          {
            id: '1',
            title: 'Agent Updated',
            description: 'Customer support agent configuration updated',
            type: 'success',
            timestamp: new Date('2024-01-15T10:30:00')
          },
          {
            id: '2',
            title: 'Deployment Successful',
            description: 'Project deployed to production environment',
            type: 'success',
            timestamp: new Date('2024-01-14T14:22:00')
          },
          {
            id: '3',
            title: 'Workflow Created',
            description: 'New escalation workflow added',
            type: 'info',
            timestamp: new Date('2024-01-13T16:45:00')
          }
        ]
      },
      'content-generator': {
        id: '2',
        name: 'Content Generator',
        description: 'Automated content creation system for marketing materials, blog posts, and social media content.',
        status: 'paused',
        icon: 'mdi-text-box',
        color: 'purple',
        agents: 1,
        workflows: 1,
        deployments: 0,
        updatedAt: new Date('2024-01-10'),
        settings: {
          autoBackup: false,
          notifications: true,
          analytics: true
        },
        recentActivity: []
      },
      'data-analyzer': {
        id: '3',
        name: 'Data Analyzer',
        description: 'Smart data analysis and reporting tool that processes large datasets and generates insights.',
        status: 'deployed',
        icon: 'mdi-chart-line',
        color: 'green',
        agents: 2,
        workflows: 3,
        deployments: 2,
        updatedAt: new Date('2024-01-08'),
        settings: {
          autoBackup: true,
          notifications: false,
          analytics: true
        },
        recentActivity: [
          {
            id: '1',
            title: 'Analysis Complete',
            description: 'Weekly data analysis completed successfully',
            type: 'success',
            timestamp: new Date('2024-01-08T09:15:00')
          }
        ]
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate loading
    
    project.value = mockProjects[projectId]
    if (!project.value) {
      error.value = true
    }
  } catch (err) {
    console.error('Failed to load project:', err)
    error.value = true
  } finally {
    loading.value = false
  }
})

// Set dynamic page title
watchEffect(() => {
  if (project.value) {
    useHead({
      title: `${project.value.name} - Projects - Cloudless.gr`
    })
  }
})
</script>

<style scoped>
.project-detail-container {
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

.glassmorphism-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glassmorphism-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.glassmorphism-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.3s ease;
}

.glassmorphism-list-item:hover {
  background: rgba(255, 255, 255, 0.1) !important;
}

/* Ensure text is readable against the clouds background */
h1, h2, h3, p, .v-chip, .v-tab {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Mobile optimizations */
@media (max-width: 599px) {
  .project-detail-container {
    padding-top: 1rem;
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

/* Tab styling */
:deep(.v-tabs) {
  background: transparent;
}

:deep(.v-tab) {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
  margin-right: 8px;
  border-radius: 8px 8px 0 0;
}

:deep(.v-tab--selected) {
  background: rgba(255, 255, 255, 0.15);
}

/* Timeline styling */
:deep(.v-timeline-item) {
  margin-bottom: 1rem;
}
</style>
