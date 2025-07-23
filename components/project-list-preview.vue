<template>
  <div>
    <v-list v-if="projects.length">
      <v-list-item v-for="project in projects" :key="project.id">
        <v-list-item-title>{{ project.project_name }}</v-list-item-title>
        <v-list-item-subtitle>{{ project.description }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
    <div v-else>
      No projects found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Project {
  id: number
  project_name: string
  description?: string
  status: string
  category: string
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')

const fetchProjects = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const response = await $fetch<{ success: boolean; data: Project[]; message?: string }>('/api/prisma/projects?limit=5')
    
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

onMounted(() => {
  fetchProjects()
})
</script>
