<template>
  <section>
    <h1>Bots</h1>
    <ul>
      <li v-for="bot in bots" :key="bot.id">
        {{ bot.name }}
      </li>
    </ul>
    <div v-if="error" class="error">{{ error }}</div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSupabase } from '~/composables/supabase'
import type { Bot } from '~/types/Bot'
import type { Database } from '~/types/database.types'

const bots = ref<Bot[]>([])
const error = ref<string | null>(null)

const supabase = useSupabase()

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('bots')
    .select('*')
  if (err) {
    error.value = err.message
  } else {
    bots.value = (data ?? []) as Bot[]
  }
})
</script>
