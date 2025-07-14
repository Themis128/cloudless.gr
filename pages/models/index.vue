<template>
  <section>
    <h1>Models</h1>
    <p>Below is a template for using a model. Select a model and use it for inference or other tasks.</p>
    <pre>
{
  "model_id": "uuid-of-model",
  "input": "Your input data here"
}
    </pre>
    <ul>
      <li v-for="model in models" :key="model.id">
        {{ model.name }}
      </li>
    </ul>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const models = ref<Database['public']['Tables']['models']['Row'][]>([])
const error = ref<string | null>(null)
const supabase = useSupabase()

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('models')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  if (err) {
    error.value = err.message
  } else {
    models.value = data ?? []
  }
})
</script>
