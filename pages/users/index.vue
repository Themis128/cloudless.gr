<template>
  <v-container class="py-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col cols="12" md="8">
        <h1 class="text-h5 font-weight-bold text-primary">
          👋 Welcome,
          <span v-if="user && (user.first_name || user.last_name)">
            {{ user.first_name }} {{ user.last_name }}
          </span>
          <span v-else>
            {{ user?.email || 'guest' }}
          </span>
        </h1>
      </v-col>
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
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useSupabase } from '@/composables/useSupabase'

// Define page meta
definePageMeta({ layout: 'user' })

// Define reactive variables with typing
const user = ref<{ first_name: string; last_name: string; email: string }>({
  first_name: '',
  last_name: '',
  email: ''
})
const projects = ref<Array<{ id: number; name: string; description: string }>>([])

// Fetch user data and projects on mount
onMounted(async () => {
  const userStore = useUserStore()
  await userStore.fetchUserProfile()

  // Update user details from store
  user.value = {
    first_name: userStore.user.first_name || '',
    last_name: userStore.user.last_name || '',
    email: userStore.user.email || ''
  }

  // Fetch user projects
  await fetchProjects()
})

// Function to fetch projects
const fetchProjects = async () => {
  try {
    const supabase = useSupabase()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    projects.value = data || []
  } catch (err) {
    console.error('Error fetching projects:', err)
    // Handle error appropriately, e.g., show a notification
  }
}
</script>

<style scoped>
/* Optional: Add more styling for the card layout */
</style>
