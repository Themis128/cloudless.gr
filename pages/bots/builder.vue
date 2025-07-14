<template>
  <section>
    <h1>Create a New Bot</h1>
    <p>Follow the template below to create a bot. Fill in the required fields and click 'Create Bot'.</p>
    <pre>
{
  "name": "MyBotName"
}
    </pre>
    <form @submit.prevent="createBot">
      <label>
        Name:
        <input v-model="name" required placeholder="e.g. MyBotName" />
      </label>
      <button type="submit">Create Bot</button>
    </form>
    <div v-if="success" class="success">Bot created!</div>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

const name = ref('')
const success = ref(false)
const error = ref<string | null>(null)
const supabase = useSupabase()

async function createBot() {
  success.value = false
  error.value = null
  const { error: err } = await supabase.from('bots').insert([{ name: name.value }])
  if (err) {
    error.value = err.message
  } else {
    success.value = true
    name.value = ''
  }
}
</script>
