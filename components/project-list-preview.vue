<template>
  <div>
    <v-list v-if="projects.length">
      <v-list-item v-for="project in projects" :key="project.id">
        <v-list-item-title>{{ project.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
    <div v-else>No projects found.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const projects = ref<Database['public']['Tables']['projects']['Row'][]>([])
const supabase = useSupabase()

onMounted(async () => {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  projects.value = data ?? []
})
</script>
