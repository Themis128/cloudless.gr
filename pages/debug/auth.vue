<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn color="primary" to="/debug" class="mb-4">
          <v-icon left>mdi-arrow-left</v-icon>
          Back to Debug Home
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="text-h5">Auth State & Diagnostics</v-card-title>
          <v-card-text>
            <DebugInspector :data="authState" title="Auth State" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Session Metrics</v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Session Active:</v-list-item-title>
                        <v-list-item-subtitle>{{ !!authState.session ? 'Yes' : 'No' }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>User ID:</v-list-item-title>
                        <v-list-item-subtitle>{{ authState.user?.id || 'N/A' }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Token Expires:</v-list-item-title>
                        <v-list-item-subtitle>{{ tokenExpires }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Session Duration (min)</v-card-title>
                  <v-card-text>
                    <v-chart :options="chartOptions" autoresize style="height:200px;" />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="text-h6">Auth Logs</v-card-title>
          <v-card-text>
            <DebugLogsViewer :logs="logs" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import DebugInspector from '~/components/debug/DebugInspector.vue'
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue'
import VChart from 'vue-echarts'
import type { Session, User } from '@supabase/auth-js'
import { useSupabase } from '~/composables/supabase'
import { useDebugTools } from '~/composables/useDebugTools'

const { logs } = useDebugTools()

const supabase = useSupabase()

const authState = ref<{ user: User | null; session: Session | null }>({
  user: null,
  session: null
})

const sessionDurations = ref<number[]>([10, 15, 8, 20, 12, 18, 25]) // Example data

const tokenExpires = computed(() => {
  const exp = authState.value.session?.expires_at
  if (!exp) return 'N/A'
  const date = new Date(exp * 1000)
  return date.toLocaleString()
})

const chartOptions = computed(() => ({
  xAxis: {
    type: 'category',
    data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  yAxis: {
    type: 'value',
    min: 0
  },
  series: [
    {
      data: sessionDurations.value,
      type: 'bar',
      smooth: true,
      color: '#1976d2',
      name: 'Session Duration'
    }
  ],
  tooltip: { trigger: 'axis' }
}))

onMounted(async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    logs.value.push(`Error fetching session: ${error.message}`)
  } else {
    authState.value.session = data.session
    authState.value.user = data.session?.user || null
    logs.value.push('Auth state loaded.')
  }
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
