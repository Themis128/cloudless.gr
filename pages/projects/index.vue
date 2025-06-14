<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Projects</h1>

    <v-list class="mb-6">
      <v-list-item
        v-for="project in projects"
        :key="project.id"
        :title="project.name"
        :subtitle="project.description"
      />
    </v-list>

    <v-form @submit.prevent="addProject" v-model="formValid">
      <v-text-field v-model="newProject.name" label="Name" required />
      <v-textarea v-model="newProject.description" label="Description" />
      <v-btn type="submit" color="primary" :disabled="!formValid">Add Project</v-btn>
    </v-form>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/useSupabase'

interface Project {
  id: number
  name: string
  description: string
  created_at?: string
}

const supabase = useSupabase()
const projects = ref<Project[]>([])
const newProject = ref<Omit<Project, 'id'>>({ name: '', description: '' })
const formValid = ref(true)

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (data) projects.value = data
  else console.error(error)
}

const addProject = async () => {
  if (!newProject.value.name.trim()) return

  const { error } = await supabase.from('projects').insert([newProject.value])
  if (error) return console.error(error)

  newProject.value = { name: '', description: '' }
  await fetchProjects()
}

onMounted(fetchProjects)
</script>
