<template>
  <div>
    <v-container fluid>
      <!-- Header Section -->
      <v-row>
        <v-col cols="12">
          <v-card class="mb-6 primary-gradient" elevation="4">
            <v-card-text class="pa-8">
              <div class="d-flex align-center justify-space-between flex-wrap">
                <div>
                  <h1 class="text-h3 font-weight-bold mb-2">Projects</h1>
                  <p class="text-h6 text-medium-emphasis mb-0">
                    Manage and organize your development projects
                  </p>
                </div>
                <v-btn
                  color="white"
                  variant="elevated"
                  size="large"
                  prepend-icon="mdi-plus"
                  @click="createNewProject"
                >
                  New Project
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Project Statistics -->
      <v-row class="mb-6">
        <v-col cols="12" md="3">
          <v-card elevation="2">
            <v-card-text class="text-center pa-4">
              <v-icon size="32" color="primary" class="mb-2">mdi-folder</v-icon>
              <h3 class="text-h4 font-weight-bold">{{ projects.length }}</h3>
              <p class="text-body-2 text-medium-emphasis">Total Projects</p>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card elevation="2">
            <v-card-text class="text-center pa-4">
              <v-icon size="32" color="success" class="mb-2">mdi-check-circle</v-icon>
              <h3 class="text-h4 font-weight-bold">{{ activeProjects }}</h3>
              <p class="text-body-2 text-medium-emphasis">Active</p>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card elevation="2">
            <v-card-text class="text-center pa-4">
              <v-icon size="32" color="warning" class="mb-2">mdi-progress-clock</v-icon>
              <h3 class="text-h4 font-weight-bold">{{ inProgressProjects }}</h3>
              <p class="text-body-2 text-medium-emphasis">In Progress</p>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card elevation="2">
            <v-card-text class="text-center pa-4">
              <v-icon size="32" color="info" class="mb-2">mdi-archive</v-icon>
              <h3 class="text-h4 font-weight-bold">{{ archivedProjects }}</h3>
              <p class="text-body-2 text-medium-emphasis">Archived</p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Filters and Search -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card elevation="2">
            <v-card-text class="pa-4">
              <v-row align="center">
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="searchQuery"
                    label="Search projects"
                    prepend-inner-icon="mdi-magnify"
                    variant="outlined"
                    density="compact"
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="statusFilter"
                    :items="statusOptions"
                    label="Status"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="typeFilter"
                    :items="typeOptions"
                    label="Type"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="2">
                  <v-btn-toggle v-model="viewMode" mandatory>
                    <v-btn icon="mdi-view-grid" value="grid" />
                    <v-btn icon="mdi-view-list" value="list" />
                  </v-btn-toggle>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Projects Grid View -->
      <v-row v-if="viewMode === 'grid'">
        <v-col
          cols="12"
          sm="6"
          md="4"
          lg="3"
          v-for="project in filteredProjects"
          :key="project.id"
        >
          <v-card elevation="2" class="h-100 project-card">
            <div class="d-flex align-center pa-4 pb-2">
              <v-avatar :color="project.color" size="40" class="mr-3">
                <v-icon color="white">{{ project.icon }}</v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <h4 class="text-h6 line-clamp-1">{{ project.name }}</h4>
                <p class="text-body-2 text-medium-emphasis mb-0">{{ project.type }}</p>
              </div>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn icon="mdi-dots-vertical" size="small" variant="text" v-bind="props" />
                </template>
                <v-list>
                  <v-list-item @click="openProject(project.id)">
                    <v-list-item-title>Open</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="editProject(project.id)">
                    <v-list-item-title>Edit</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="archiveProject(project.id)">
                    <v-list-item-title>Archive</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
            
            <v-card-text class="pt-0">
              <p class="text-body-2 text-medium-emphasis line-clamp-2 mb-3">
                {{ project.description }}
              </p>
              
              <div class="d-flex align-center justify-space-between mb-3">
                <v-chip :color="getStatusColor(project.status)" size="small" variant="tonal">
                  {{ project.status }}
                </v-chip>
                <span class="text-caption">{{ formatDate(project.lastModified) }}</span>
              </div>

              <v-progress-linear
                v-if="project.progress !== undefined"
                :model-value="project.progress"
                height="4"
                color="primary"
                class="mb-2"
              />
              
              <div class="d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-avatar
                    v-for="member in project.team.slice(0, 3)"
                    :key="member.id"
                    size="24"
                    class="mr-1"
                  >
                    <img v-if="member.avatar" :src="member.avatar" :alt="member.name" />
                    <span v-else class="text-caption">{{ member.name.charAt(0) }}</span>
                  </v-avatar>
                  <span v-if="project.team.length > 3" class="text-caption ml-1">
                    +{{ project.team.length - 3 }}
                  </span>
                </div>
                <v-btn size="small" variant="text" color="primary" @click="openProject(project.id)">
                  Open
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Projects List View -->
      <v-row v-if="viewMode === 'list'">
        <v-col cols="12">
          <v-card elevation="2">
            <v-data-table
              :headers="projectHeaders"
              :items="filteredProjects"
              :loading="loading"
              item-value="id"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-avatar :color="item.color" size="32" class="mr-3">
                    <v-icon color="white" size="16">{{ item.icon }}</v-icon>
                  </v-avatar>
                  <div>
                    <div class="font-weight-medium">{{ item.name }}</div>
                    <div class="text-body-2 text-medium-emphasis">{{ item.type }}</div>
                  </div>
                </div>
              </template>

              <template #item.status="{ item }">
                <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
                  {{ item.status }}
                </v-chip>
              </template>

              <template #item.progress="{ item }">
                <div class="d-flex align-center" style="min-width: 120px;">
                  <v-progress-linear
                    :model-value="item.progress || 0"
                    height="6"
                    color="primary"
                    class="flex-grow-1"
                  />
                  <span class="ml-2 text-body-2">{{ item.progress || 0 }}%</span>
                </div>
              </template>

              <template #item.team="{ item }">
                <div class="d-flex align-center">
                  <v-avatar
                    v-for="member in item.team.slice(0, 3)"
                    :key="member.id"
                    size="24"
                    class="mr-1"
                  >
                    <img v-if="member.avatar" :src="member.avatar" :alt="member.name" />
                    <span v-else class="text-caption">{{ member.name.charAt(0) }}</span>
                  </v-avatar>
                  <span v-if="item.team.length > 3" class="text-caption ml-1">
                    +{{ item.team.length - 3 }}
                  </span>
                </div>
              </template>

              <template #item.lastModified="{ item }">
                <span class="text-body-2">{{ formatDate(item.lastModified) }}</span>
              </template>

              <template #item.actions="{ item }">
                <v-btn icon="mdi-open-in-new" size="small" variant="text" @click="openProject(item.id)" />
                <v-btn icon="mdi-pencil" size="small" variant="text" @click="editProject(item.id)" />
                <v-btn icon="mdi-dots-vertical" size="small" variant="text" @click="showProjectMenu(item.id)" />
              </template>
            </v-data-table>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Projects'
})

interface TeamMember {
  id: number
  name: string
  avatar: string | null
}

interface Project {
  id: number
  name: string
  description: string
  type: string
  status: string
  progress: number
  icon: string
  color: string
  lastModified: Date
  team: TeamMember[]
}

const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const viewMode = ref('grid')

const projects = ref([
  {
    id: 1,
    name: 'E-commerce Platform',
    description: 'Modern online shopping experience with advanced features',
    type: 'Web Application',
    status: 'active',
    progress: 85,
    icon: 'mdi-shopping',
    color: 'primary',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2),
    team: [
      { id: 1, name: 'John Doe', avatar: null },
      { id: 2, name: 'Jane Smith', avatar: null },
      { id: 3, name: 'Bob Johnson', avatar: null }
    ]
  },
  {
    id: 2,
    name: 'Task Management API',
    description: 'RESTful API for comprehensive task and project management',
    type: 'API Service',
    status: 'development',
    progress: 60,
    icon: 'mdi-api',
    color: 'success',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24),
    team: [
      { id: 4, name: 'Alice Brown', avatar: null },
      { id: 5, name: 'Charlie Wilson', avatar: null }
    ]
  },
  {
    id: 3,
    name: 'Mobile Fitness App',
    description: 'Cross-platform fitness tracking and wellness application',
    type: 'Mobile Application',
    status: 'planning',
    progress: 25,
    icon: 'mdi-cellphone',
    color: 'warning',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 48),
    team: [
      { id: 6, name: 'David Lee', avatar: null }
    ]
  },
  {
    id: 4,
    name: 'Analytics Dashboard',
    description: 'Business intelligence dashboard with real-time analytics',
    type: 'Web Application',
    status: 'completed',
    progress: 100,
    icon: 'mdi-chart-line',
    color: 'info',
    lastModified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    team: [
      { id: 7, name: 'Eva Martinez', avatar: null },
      { id: 8, name: 'Frank Chen', avatar: null },
      { id: 9, name: 'Grace Kim', avatar: null },
      { id: 10, name: 'Henry Park', avatar: null }
    ]
  }
])

const projectHeaders = [
  { title: 'Project', value: 'name' },
  { title: 'Status', value: 'status' },
  { title: 'Progress', value: 'progress' },
  { title: 'Team', value: 'team' },
  { title: 'Last Modified', value: 'lastModified' },
  { title: 'Actions', value: 'actions', sortable: false }
]

const statusOptions = ['', 'active', 'development', 'planning', 'completed', 'archived']
const typeOptions = ['', 'Web Application', 'Mobile Application', 'API Service', 'Desktop Application']

const activeProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'active').length
)

const inProgressProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'development').length
)

const archivedProjects = computed(() => 
  projects.value.filter((p: Project) => p.status === 'archived').length
)

const filteredProjects = computed(() => {
  let filtered = projects.value

  if (searchQuery.value) {
    filtered = filtered.filter((p: Project) => 
      p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter((p: Project) => p.status === statusFilter.value)
  }

  if (typeFilter.value) {
    filtered = filtered.filter((p: Project) => p.type === typeFilter.value)
  }

  return filtered
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'development': return 'primary'
    case 'planning': return 'warning'
    case 'completed': return 'info'
    case 'archived': return 'default'
    default: return 'default'
  }
}

const formatDate = (date: Date) => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    .format(Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 'day')
}

const createNewProject = () => {
  navigateTo('/projects/new')
}

const openProject = (projectId: number) => {
  navigateTo(`/projects/${projectId}`)
}

const editProject = (projectId: number) => {
  navigateTo(`/projects/${projectId}/edit`)
}

const archiveProject = (projectId: number) => {
  // Archive project logic
  console.log(`Archiving project ${projectId}`)
}

const showProjectMenu = (projectId: number) => {
  // Show context menu for project
  console.log(`Showing menu for project ${projectId}`)
}
</script>

<style scoped>
.project-card {
  transition: all 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
