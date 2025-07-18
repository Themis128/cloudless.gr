<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn color="primary" to="/debug" class="mb-4">
          <v-icon left>
            mdi-arrow-left
          </v-icon>
          Back to Debug Home
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title
            class="text-h5 d-flex align-center justify-space-between"
          >
            Ping API Server
            <v-btn
              icon
              :loading="loading"
              :disabled="loading"
              @click="ping"
            >
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <DebugConsole :output="logs" title="Ping Log" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">
                    Ping Metrics
                  </v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Total Pings:</v-list-item-title>
                        <v-list-item-subtitle>
                          {{
                            latencyHistory.length
                          }}
                        </v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Last Latency:</v-list-item-title>
                        <v-list-item-subtitle>
                          {{ lastLatency }} ms
                        </v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Online Rate:</v-list-item-title>
                        <v-list-item-subtitle>
                          {{ onlineRate }}%
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">
                    Latency History (ms)
                  </v-card-title>
                  <v-card-text>
                    <client-only>
                      <component
                        :is="VChart"
                        v-if="VChart"
                        :option="chartOptions"
                        autoresize
                        style="height: 200px"
                      />
                    </client-only>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-h6">
            Network State
          </v-card-title>
          <v-card-text>
            <DebugInspector :data="networkState" />
          </v-card-text>
        </v-card>
        <v-card class="mt-4">
          <v-card-title class="text-h6">
            Diagnostics
          </v-card-title>
          <v-card-text>
            <v-list dense>
              <v-list-item>
                <v-list-item-title>Status:</v-list-item-title>
                <v-list-item-subtitle>
                  {{
                    diagnosticStatus
                  }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <v-list-item-title>Last Updated:</v-list-item-title>
                <v-list-item-subtitle>{{ lastUpdated }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed, onMounted, ref } from 'vue'
import DebugConsole from '~/components/debug/DebugConsole.vue'
import DebugInspector from '~/components/debug/DebugInspector.vue'
import { useDebugTools } from '~/composables/useDebugTools'
const VChart = ref()

const networkState = ref<{ status: string; latency: string | null }>({
  status: 'checking...',
  latency: null,
})
const { logs } = useDebugTools()
const loading = ref(false)
const latencyHistory = ref<number[]>([])
const onlineHistory = ref<boolean[]>([])
const lastUpdated = computed(() => new Date().toLocaleString())
const diagnosticStatus = computed(() => networkState.value.status)

const ping = async () => {
  loading.value = true
  const start = Date.now()
  logs.value.push(`Pinging API server...`)
  try {
    await fetch('http://127.0.0.1:54321/health')
    const latency = Date.now() - start
    networkState.value = { status: 'online', latency: `${latency}ms` }
    logs.value.push(`✅ Online (${latency}ms)`)
    latencyHistory.value.push(latency)
    onlineHistory.value.push(true)
  } catch (error) {
    networkState.value = { status: 'offline', latency: 'N/A' }
    logs.value.push(`❌ Offline`)
    latencyHistory.value.push(0)
    onlineHistory.value.push(false)
  }
  loading.value = false
}

onMounted(async () => {
  const mod = await import('vue-echarts')
  VChart.value = mod.default
  ping()
})

const lastLatency = computed(() => {
  if (latencyHistory.value.length === 0) return 'N/A'
  return latencyHistory.value[latencyHistory.value.length - 1]
})

const onlineRate = computed(() => {
  if (onlineHistory.value.length === 0) return 0
  const onlineCount = onlineHistory.value.filter(Boolean).length
  return ((onlineCount / onlineHistory.value.length) * 100).toFixed(0)
})

const chartOptions = computed<EChartsOption>(() => ({
  backgroundColor: '#1e1e2f',
  textStyle: {
    color: '#ccc',
  },
  legend: {
    textStyle: { color: '#fff' },
  },
  toolbox: {
    feature: {
      saveAsImage: {},
    },
  },
  xAxis: {
    type: 'category',
    data: latencyHistory.value.map((_, i) => `${i + 1}`),
  },
  yAxis: {
    type: 'value',
    min: 0,
    name: 'ms',
  },
  series: [
    {
      data: latencyHistory.value,
      type: 'line',
      smooth: true,
      color: '#43a047',
      name: 'Latency',
    },
  ],
  tooltip: { trigger: 'axis' },
}))
</script>
