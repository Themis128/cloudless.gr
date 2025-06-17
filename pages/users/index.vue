<template>
  <v-container class="py-10">
    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" size="64" />
      <p class="mt-4 text-secondary">Loading your dashboard...</p>
    </div>

    <!-- Error state -->
    <v-alert v-else-if="error" type="error" class="mb-6">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" @click="retryLoad">
          Retry
        </v-btn>
      </template>
    </v-alert>

    <!-- Main content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col cols="12" md="8">
          <h1 class="text-h4 font-weight-bold text-primary">
            👋 Welcome,
            <span v-if="userProfile && (userProfile.first_name || userProfile.last_name)">
              {{ userProfile.first_name }} {{ userProfile.last_name }}
            </span>
            <span v-else-if="userProfile?.email">
              {{ userProfile.email }}
            </span>
            <span v-else>
              User
            </span>
          </h1>
        </v-col>
        <v-col cols="12" md="4" class="text-right">
          <v-btn
            color="primary"
            variant="elevated"
            size="large"
            @click="navigateToCreateProject"
          >
            <v-icon start>mdi-plus</v-icon>
            New Project
          </v-btn>
        </v-col>
      </v-row>

      <!-- Projects section -->
      <div v-if="projects.length > 0">
        <h2 class="text-h6 mb-4 text-secondary">Your Projects</h2>
        <v-row dense>
          <v-col
            v-for="project in projects"
            :key="project.id"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card
              class="pa-4 h-100"
              elevation="2"
              hover
              @click="navigateToProject(project.id)"
            >
              <v-card-title class="text-primary font-weight-medium">
                {{ project.name }}
              </v-card-title>
              <v-card-text class="text-secondary">
                {{ project.description || 'No description available.' }}
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  variant="text"
                  size="small"
                  color="primary"
                  @click.stop="navigateToProject(project.id)"
                >
                  View Details
                  <v-icon end size="small">mdi-arrow-right</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-16">
        <v-icon size="80" color="grey-lighten-2" class="mb-4">
          mdi-folder-open-outline
        </v-icon>
        <h3 class="text-h6 mb-2 text-secondary">No Projects Yet</h3>
        <p class="text-body-2 text-grey mb-6">
          Create your first project to get started with your AI development journey.
        </p>
        <v-btn
          color="primary"
          variant="elevated"
          size="large"
          @click="navigateToCreateProject"
        >
          <v-icon start>mdi-plus</v-icon>
          Create Your First Project
        </v-btn>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
// Define page meta
definePageMeta({ layout: 'user' })

// Require authentication for this page
await useAuthRequired()

// Define reactive variables with proper typing
const loading = ref(true)
const error = ref<string | null>(null)
const userProfile = ref<{
  first_name?: string
  last_name?: string
  full_name?: string
  email?: string
} | null>(null)

// Project type based on database schema
type Project = {
  id: number
  name: string
  description: string | null
  created_at?: string
  user_id?: string
}

const projects = ref<Project[]>([])

// Navigation functions
const navigateToProject = (projectId: number) => {
  navigateTo(`/projects/${projectId}`)
}

const navigateToCreateProject = () => {
  navigateTo('/projects/create')
}

// Retry function for error recovery
const retryLoad = async () => {
  error.value = null
  loading.value = true
  await loadUserData()
}

// Load user data and projects
const loadUserData = async () => {
  try {
    loading.value = true
    error.value = null

    // Get current user from Supabase
    const supabase = useSupabaseClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      throw new Error('Unable to authenticate user')
    }

    // Set basic user profile from auth
    userProfile.value = {
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || '',
      first_name: authUser.user_metadata?.first_name || '',
      last_name: authUser.user_metadata?.last_name || ''
    }    // Try to get additional profile data from database
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user-info')
        .select('full_name')
        .eq('id', authUser.id)
        .maybeSingle<{ full_name?: string }>()

      if (!profileError && profileData && profileData.full_name) {
        userProfile.value.full_name = profileData.full_name || userProfile.value.full_name
        
        // Parse full_name into first/last if available
        if (profileData.full_name && !userProfile.value.first_name && !userProfile.value.last_name) {
          const nameParts = profileData.full_name.split(' ')
          userProfile.value.first_name = nameParts[0] || ''
          userProfile.value.last_name = nameParts.slice(1).join(' ') || ''
        }
      }
    } catch (profileErr) {
      // Profile data is optional, continue without it
      console.warn('Could not load additional profile data:', profileErr)
    }

    // Fetch user projects
    await fetchProjects()
    
  } catch (err) {
    console.error('Error loading user data:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load user data'
  } finally {
    loading.value = false
  }
}

// Function to fetch projects
const fetchProjects = async () => {
  try {
    const supabase = useSupabaseClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description, created_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    projects.value = data || []
  } catch (err) {
    console.error('Error fetching projects:', err)
    throw err
  }
}

// Load data on component mount
onMounted(() => {
  loadUserData()
})
</script>

<style scoped>
.h-100 {
  height: 100%;
}

.v-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  cursor: pointer;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

.py-16 {
  padding-top: 4rem !important;
  padding-bottom: 4rem !important;
}

/* Ensure consistent card heights */
.v-col .v-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.v-card-text {
  flex-grow: 1;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .py-16 {
    padding-top: 2rem !important;
    padding-bottom: 2rem !important;
  }
}
</style>
