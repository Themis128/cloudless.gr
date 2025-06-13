<template>
  <v-container class="py-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col cols="12" md="8">
        <h1 class="text-h5 font-weight-bold text-primary">👋 Welcome, {{ user?.first_name || '' }} {{ user?.last_name ||
          '' }}<span v-if="!user?.first_name && !user?.last_name">{{ user?.email || 'guest' }}</span></h1>
      </v-col>
      <!-- Theme toggle button removed; handled by layout -->
    </v-row>

    <div v-if="projects.length">
      <v-row dense>
        <v-col v-for="project in projects" :key="project.id" cols="12" md="6" lg="4">
          <v-card class="pa-4" elevation="4" color="surface">
            <v-card-title class="text-primary font-weight-medium">
              {{ project.name }}
            </v-card-title>
            <v-card-text class="text-secondary">
              {{ project.description || 'No description.' }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <div v-else class="text-center mt-10">
      <v-icon size="40" color="grey lighten-1">mdi-folder-open</v-icon>
      <p class="text-grey-lighten-1 mt-2">No projects found.</p>
    </div>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'user' })

const supabase = useSupabase()
const user = ref<any>(null)
const projects = ref<any[]>([])

const fetchUserProfile = async () => {
  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData.user
  if (authUser) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', authUser.id)
      .single()
    user.value = {
      ...authUser,
      ...profile
    }
  }
}

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (!error && data) {
    projects.value = data
  }
}

onMounted(async () => {
  await fetchUserProfile()
  await fetchProjects()
})
</script>
