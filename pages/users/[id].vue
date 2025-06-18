<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <!-- Loading State -->
        <v-card v-if="loading" class="elevation-4 text-center pa-8">
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4">Loading user profile...</p>
        </v-card>

        <!-- Error State -->
        <v-card v-else-if="error" class="elevation-4 text-center pa-8">
          <v-icon size="64" color="error">mdi-account-off</v-icon>
          <h2 class="text-h5 mt-4 mb-2">User Not Found</h2>
          <p class="text-grey-darken-1">The user you're looking for doesn't exist or has been removed.</p>
          <v-btn class="mt-4" variant="outlined" @click="$router.push('/')">
            Go Home
          </v-btn>
        </v-card>

        <!-- User Profile -->
        <v-card v-else class="elevation-4">
          <v-card-text class="pa-6 text-center">
            <!-- Avatar -->
            <v-avatar size="120" class="mb-4">
              <v-img
                :src="profile?.avatar_url || `https://ui-avatars.com/api/?name=${displayName}&size=120&background=1976d2&color=fff`"
                :alt="`${displayName} avatar`"
              />
            </v-avatar>

            <!-- User Info -->
            <h1 class="text-h4 font-weight-bold mb-2">{{ displayName }}</h1>
            <p v-if="profile?.bio" class="text-body-1 text-grey-darken-1 mb-4">
              {{ profile.bio }}
            </p>

            <!-- Stats -->
            <v-row class="mt-6">
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="primary" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-calendar-account</v-icon>
                  <div class="text-subtitle2">Member Since</div>
                  <div class="text-h6">{{ formatDate(profile?.created_at) }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="success" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-folder-multiple</v-icon>
                  <div class="text-subtitle2">Public Projects</div>
                  <div class="text-h6">{{ publicProjectsCount || 0 }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="4">
                <v-card variant="tonal" color="info" class="text-center pa-4">
                  <v-icon size="32" class="mb-2">mdi-heart</v-icon>
                  <div class="text-subtitle2">Contributions</div>
                  <div class="text-h6">{{ contributionsCount || 0 }}</div>
                </v-card>
              </v-col>
            </v-row>

            <!-- Public Projects -->
            <div v-if="publicProjects && publicProjects.length > 0" class="mt-6">
              <h3 class="text-h6 font-weight-bold mb-4">Public Projects</h3>
              <v-row>
                <v-col
                  v-for="project in publicProjects.slice(0, 3)"
                  :key="project.id"
                  cols="12"
                  sm="4"
                >
                  <v-card variant="outlined" class="pa-4">
                    <h4 class="text-subtitle-1 font-weight-medium mb-2">
                      {{ project.name }}
                    </h4>
                    <p v-if="project.description" class="text-body-2 text-grey-darken-1">
                      {{ project.description.substring(0, 100) }}{{ project.description.length > 100 ? '...' : '' }}
                    </p>
                    <v-btn
                      class="mt-3"
                      size="small"
                      variant="outlined"
                      @click="$router.push(`/projects/${project.id}`)"
                    >
                      View Project
                    </v-btn>
                  </v-card>
                </v-col>
              </v-row>
              <div v-if="publicProjects.length > 3" class="text-center mt-4">
                <v-btn variant="outlined" @click="$router.push(`/projects?user=${route.params.id}`)">
                  View All Projects ({{ publicProjects.length }})
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
const route = useRoute()
const supabase = useSupabaseClient()

// Reactive data
const loading = ref(true)
const error = ref(false)
const profile = ref(null)
const publicProjects = ref([])

// Computed
const displayName = computed(() => {
  if (!profile.value) return 'User'

  const firstName = profile.value.first_name
  const lastName = profile.value.last_name

  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim()
  }

  return profile.value.email || 'User'
})

const publicProjectsCount = computed(() => {
  return publicProjects.value?.length || 0
})

const contributionsCount = computed(() => {
  // In a real app, this would be calculated from contributions/collaborations
  return Math.floor(Math.random() * 50) + 1
})

// Methods
const loadUserProfile = async () => {
  try {
    const userId = route.params.id

    // Load user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    profile.value = userProfile

    // Load public projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('Error loading projects:', projectsError)
      // Don't throw, just log - profile can still be shown without projects
    } else {
      publicProjects.value = projects || []
    }
  } catch (err) {
    console.error('Error loading user profile:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(() => {
  loadUserProfile()
})

// Watch route changes
watch(() => route.params.id, () => {
  if (route.params.id) {
    loading.value = true
    error.value = false
    loadUserProfile()
  }
})

// Page meta
definePageMeta({
  layout: 'default',
  title: 'User Profile'
})

// SEO
useSeoMeta({
  title: computed(() => `${displayName.value} - Cloudless.gr`),
  description: computed(() => profile.value?.bio || `View ${displayName.value}'s profile on Cloudless.gr`)
})
</script>
