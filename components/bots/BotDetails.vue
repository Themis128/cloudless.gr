<template>
  <v-card class="bg-white">
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
        <div><strong>Description:</strong> {{ bot?.description }}</div>
        <div><strong>Status:</strong> {{ bot?.status }}</div>
        <div><strong>Config:</strong> {{ bot?.config }}</div>
        <div><strong>Created:</strong> {{ formatDate(bot?.createdAt) }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface Bot {
  id: number
  name: string
  description?: string
  config: string
  status: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: number
    name: string
    email: string
  }
}

const props = defineProps<{ botId: string }>()
const bot = ref<Bot | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const fetchBot = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await $fetch<{ success: boolean; data: Bot; message?: string }>(`/api/prisma/bots/${props.botId}`)
    
    if (response.success) {
      bot.value = response.data
    } else {
      error.value = response.message || 'Failed to fetch bot details'
    }
  } catch (err: any) {
    console.error('Error fetching bot:', err)
    error.value = err.message || 'Failed to load bot details'
  } finally {
    loading.value = false
  }
}

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  fetchBot()
})
</script>
