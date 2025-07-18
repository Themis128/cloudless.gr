<template>
  <v-card>
    <v-card-title>Bot Details</v-card-title>
    <v-card-text>
      <v-alert type="info" class="mb-4">
        View your bot's details and test its pipeline.
      </v-alert>
      <v-toolbar flat color="transparent" class="mb-4">
        <v-btn color="primary" :to="`/bots/${botId}/test`" variant="text">
          Test Bot
        </v-btn>
      </v-toolbar>
      <div v-if="loading">
        <v-progress-linear indeterminate color="primary" />
      </div>
      <div v-else-if="error">
        <v-alert type="error">
          {{ error }}
        </v-alert>
      </div>
      <div v-else>
        <div><strong>Name:</strong> {{ bot?.name }}</div>
        <div><strong>Prompt:</strong> {{ bot?.prompt }}</div>
        <div><strong>Model:</strong> {{ bot?.model }}</div>
        <div><strong>Memory:</strong> {{ bot?.memory }}</div>
        <div><strong>Tools:</strong> {{ bot?.tools }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'

const props = defineProps<{ botId: string }>()
const supabase = useSupabase()
const bot = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  const { data, error: err } = await supabase.from('bots').select('*').eq('id', props.botId).single()
  if (err) {
    error.value = err.message
  } else {
    bot.value = data
  }
  loading.value = false
})
</script>
