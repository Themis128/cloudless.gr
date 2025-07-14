<template>
  <section>
    <h1>Create Project</h1>
    <p>Use the template below to create a new project. Fill in the fields and click 'Create Project'.</p>
    <pre>
{
  "name": "MyProject",
  "description": "Project description"
}
    </pre>
    <form @submit.prevent="createProject">
      <label>
        Name:
        <input v-model="name" required placeholder="e.g. MyProject" />
      </label>
      <label>
        Description:
        <input v-model="description" placeholder="Project description" />
      </label>
      <button type="submit">Create Project</button>
    </form>
    <div v-if="success" class="success">Project created!</div>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const name = ref('')
const description = ref('')
const success = ref(false)
const error = ref<string | null>(null)
const supabase = useSupabase()

async function createProject() {
  success.value = false
  error.value = null
  const { error: err } = await supabase.from('projects').insert([{ name: name.value, description: description.value }])
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    name.value = ''
    description.value = ''
  }
}
</script>
