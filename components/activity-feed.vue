<template>
  <div>
    <v-list v-if="logs.length">
      <v-list-item v-for="log in logs" :key="log.id">
        <v-list-item-title>{{ log.action }}</v-list-item-title>
        <v-list-item-subtitle>{{ formatDate(log.created_at) }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
    <div v-else>
      No recent activity.
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface AuditLog {
  id: number
  action: string
  created_at: Date
  resource_type?: string
  resource_id?: string
  user_id?: number
  ip_address?: string
  user_agent?: string
  old_values?: any
  new_values?: any
}

const logs = ref<AuditLog[]>([])
const loading = ref(true)
const error = ref('')

const fetchLogs = async () => {
  try {
    loading.value = true
    error.value = ''
    
    const response = await $fetch<{ success: boolean; data: AuditLog[]; message?: string }>('/api/activity/recent')
    
    if (response.success) {
      logs.value = response.data || []
    } else {
      error.value = response.message || 'Failed to fetch activity logs'
    }
  } catch (err: any) {
    console.error('Error fetching activity logs:', err)
    error.value = err.message || 'Failed to load activity logs'
  } finally {
    loading.value = false
  }
}

const formatDate = (date: Date | string): string => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  fetchLogs()
})
</script>
