<template>
  <div>
    <v-list v-if="logs.length">
      <v-list-item v-for="log in logs" :key="log.id">
        <v-list-item-title>{{ log.action }}</v-list-item-title>
        <v-list-item-subtitle>{{ log.created_at }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
    <div v-else>
      No recent activity.
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSupabase } from '~/composables/supabase'

type AuditLog = {
  id: string
  action: string
  created_at: string | null
  resource_type: string | null
  resource_id: string | null
  user_id: string | null
  ip_address: unknown
  user_agent: string | null
  old_values: any
  new_values: any
}

const logs = ref<AuditLog[]>([])
const supabase = useSupabase()

onMounted(async () => {
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  logs.value = data ?? []
})
</script>
