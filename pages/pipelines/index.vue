<template>
  <section>
    <h1>Pipelines</h1>
    <p>Use the template below to create a new pipeline. Fill in the fields and click 'Create Pipeline'.</p>
    <pre>
{
  "name": "MyPipeline",
  "config": { "steps": [] }
}
    </pre>
    <ul>
      <li v-for="pipeline in pipelines" :key="pipeline.id">
        {{ pipeline.name }}
      </li>
    </ul>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Database } from '~/types/database.types'

const pipelines = ref<Database['public']['Tables']['pipelines']['Row'][]>([])
const error = ref<string | null>(null)
const supabase = useSupabase()

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('pipelines')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)
  if (err) {
    error.value = err.message
  } else {
    pipelines.value = data ?? []
  }
})
</script>
