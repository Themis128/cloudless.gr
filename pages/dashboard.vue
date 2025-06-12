<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">👋 Welcome, {{ user?.email }}</h1>

    <div v-if="projects.length">
      <h2 class="text-xl font-semibold mb-2">📁 Your Projects</h2>
      <ul class="space-y-2">
        <li
          v-for="project in projects"
          :key="project.id"
          class="p-4 border border-gray-200 rounded"
        >
          <strong>{{ project.name }}</strong
          ><br />
          <span class="text-gray-600">{{ project.description }}</span>
        </li>
      </ul>
    </div>

    <div v-else class="mt-4 text-gray-500">No projects found.</div>

    <div class="mt-6">
      <!-- Removed links to Projects, Dashboard, Sitemap -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { supabase } from '~/composables/useSupabase';

const user = (await supabase.auth.getUser()).data.user;
const projects = ref<any[]>([]);

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    // .eq('user_id', user?.id) // Uncomment if you add user_id to projects
    .order('created_at', { ascending: false });

  if (!error) {
    projects.value = data ?? [];
  }
};

onMounted(fetchProjects);
</script>

<style scoped>
.btn {
  display: inline-block;
  background-color: #2563eb; /* blue-600 */
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: background 0.2s;
  text-decoration: none;
}
.btn:hover {
  background-color: #1d4ed8; /* blue-700 */
}
</style>
