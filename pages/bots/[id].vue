<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8" lg="6">
        <v-card>
          <v-card-title>Bot Details</v-card-title>
          <v-card-text>
            <v-alert type="info" class="mb-4">
              View your bot's details and test its pipeline.
            </v-alert>
            <v-toolbar flat color="transparent" class="mb-4">
              <v-btn color="primary" :to="`/bots/${botId}/test`" variant="text">Test Bot</v-btn>
            </v-toolbar>
            <div v-if="loading">
              <v-progress-linear indeterminate color="primary" />
            </div>
            <div v-else-if="error">
              <v-alert type="error">{{ error }}</v-alert>
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
        <!-- Embed interactive test interface below -->
        <v-card class="mt-6">
          <v-card-title>Interactive Bot Test</v-card-title>
          <v-card-text>
            <BotTest :bot-id="botId" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '~/composables/supabase'
import BotTest from '~/components/bots/BotTest.vue'

const route = useRoute()
const botId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
const supabase = useSupabase()
const bot = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  const { data, error: err } = await supabase.from('bots').select('*').eq('id', botId).single()
  if (err) {
    error.value = err.message
  } else {
    bot.value = data
  }
  loading.value = false
})
</script>
