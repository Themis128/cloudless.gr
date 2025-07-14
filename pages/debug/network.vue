<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-h5 d-flex align-center justify-space-between">
            Ping API Server
            <v-btn icon @click="ping" :loading="loading" :disabled="loading">
              <v-icon>mdi-refresh</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text>
            <DebugConsole :output="logOutput" title="Ping Log" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Ping Metrics</v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Total Pings:</v-list-item-title>
                        <v-list-item-subtitle>{{ latencyHistory.length }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Last Latency:</v-list-item-title>
                        <v-list-item-subtitle>{{ lastLatency }} ms</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Online Rate:</v-list-item-title>
                        <v-list-item-subtitle>{{ onlineRate }}%</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Latency History (ms)</v-card-title>
                  <v-card-text>
                    <v-chart :options="chartOptions" autoresize style="height:200px;" />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-h6">Network State</v-card-title>
          <v-card-text>
            <DebugInspector :data="networkState" />
          </v-card-text>
        </v-card>
        <v-card class="mt-4">
          <v-card-title class="text-h6">Diagnostics</v-card-title>
          <v-card-text>
            <v-list dense>
              <v-list-item>
                <v-list-item-title>Status:</v-list-item-title>
                <v-list-item-subtitle>{{ diagnosticStatus }}</v-list-item-subtitle>
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
import { ref, computed, onMounted } from 'vue';
import DebugConsole from '~/components/debug/DebugConsole.vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';
import VChart from 'vue-echarts';

const networkState = ref<{ status: string; latency: string | null }>({ status: 'checking...', latency: null });
const logOutput = ref('');
const loading = ref(false);
const latencyHistory = ref<number[]>([]);
const onlineHistory = ref<boolean[]>([]);
const lastUpdated = computed(() => new Date().toLocaleString());
const diagnosticStatus = computed(() => networkState.value.status);

async function ping() {
  loading.value = true;
  const start = Date.now();
  logOutput.value += `Pinging API server...\n`;
  try {
    await fetch('http://127.0.0.1:54321/health');
    const latency = Date.now() - start;
    networkState.value = { status: 'online', latency: `${latency}ms` };
    logOutput.value += `✅ Online (${latency}ms)\n`;
    latencyHistory.value.push(latency);
    onlineHistory.value.push(true);
  } catch (error) {
    networkState.value = { status: 'offline', latency: 'N/A' };
    logOutput.value += `❌ Offline\n`;
    latencyHistory.value.push(0);
    onlineHistory.value.push(false);
  }
  loading.value = false;
}

onMounted(() => {
  ping();
});

const lastLatency = computed(() => {
  if (latencyHistory.value.length === 0) return 'N/A';
  return latencyHistory.value[latencyHistory.value.length - 1];
});

const onlineRate = computed(() => {
  if (onlineHistory.value.length === 0) return 0;
  const onlineCount = onlineHistory.value.filter(Boolean).length;
  return ((onlineCount / onlineHistory.value.length) * 100).toFixed(0);
});

const chartOptions = computed(() => ({
  xAxis: {
    type: 'category',
    data: latencyHistory.value.map((_, i) => `${i + 1}`)
  },
  yAxis: {
    type: 'value',
    min: 0
  },
  series: [
    {
      data: latencyHistory.value,
      type: 'line',
      smooth: true,
      color: '#43a047',
      name: 'Latency'
    }
  ],
  tooltip: { trigger: 'axis' }
}));
</script>
