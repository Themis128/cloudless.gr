<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Projects</h1>

    <ul class="mb-6">
      <li v-for="project in projects" :key="project.id">
        <strong>{{ project.name }}</strong
        >: {{ project.description }}
      </li>
    </ul>

    <form @submit.prevent="addProject" class="space-y-2">
      <input
        v-model="newProject.name"
        placeholder="Name"
        class="border px-2 py-1 w-full"
        required
      />
      <input
        v-model="newProject.description"
        placeholder="Description"
        class="border px-2 py-1 w-full"
      />
      <button type="submit" class="bg-blue-600 text-white px-4 py-1">Add Project</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSupabase } from '~/composables/useSupabase';
const supabase = useSupabase();

const projects = ref<any[]>([]);
const newProject = ref({ name: '', description: '' });

const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (data) projects.value = data;
};

const addProject = async () => {
  if (!newProject.value.name) return;

  const { error } = await supabase.from('projects').insert([newProject.value]);

  if (!error) {
    newProject.value = { name: '', description: '' };
    await fetchProjects();
  }
};

onMounted(fetchProjects);
</script>
