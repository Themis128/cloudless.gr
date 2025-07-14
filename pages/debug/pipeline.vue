<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="text-h5 d-flex align-center justify-space-between">
            Pipeline Status
            <v-btn color="primary" @click="runAll">Run Pipeline</v-btn>
          </v-card-title>
          <v-card-text>
            <DebugInspector :data="pipelineStatus" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Run Metrics</v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Total Runs:</v-list-item-title>
                        <v-list-item-subtitle>{{ runDurations.length }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Last Run Duration:</v-list-item-title>
                        <v-list-item-subtitle>{{ lastRunDuration }} ms</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Success Rate:</v-list-item-title>
                        <v-list-item-subtitle>{{ successRate }}%</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Run Durations (ms)</v-card-title>
                  <v-card-text>
                    <v-chart :options="chartOptions" autoresize style="height:200px;" />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="text-h6">Pipeline Logs</v-card-title>
          <v-card-text>
            <DebugLogsViewer :logs="pipelineLogs" />
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
import DebugInspector from '~/components/debug/DebugInspector.vue';
import DebugLogsViewer from '~/components/debug/DebugLogsViewer.vue';
import VChart from 'vue-echarts';
import { usePipelineDebug } from '~/composables/usePipelineDebug';

const { pipelineStatus, pipelineLogs, runAll } = usePipelineDebug();
const runDurations = ref<number[]>([]);
const runSuccess = ref<boolean[]>([]);
const lastUpdated = computed(() => new Date().toLocaleString());
const diagnosticStatus = computed(() => pipelineStatus.value?.step || 'unknown');

function simulateRun() {
  // Simulate a pipeline run duration and success
  const duration = 500 + Math.floor(Math.random() * 1500);
  runDurations.value.push(duration);
  runSuccess.value.push(Math.random() > 0.2); // 80% success rate
}

function runAllWithMetrics() {
  runAll();
  simulateRun();
}

const lastRunDuration = computed(() => {
  if (runDurations.value.length === 0) return 'N/A';
  return runDurations.value[runDurations.value.length - 1];
});

const successRate = computed(() => {
  if (runSuccess.value.length === 0) return 0;
  const successCount = runSuccess.value.filter(Boolean).length;
  return ((successCount / runSuccess.value.length) * 100).toFixed(0);
});

const chartOptions = computed(() => ({
  xAxis: {
    type: 'category',
    data: runDurations.value.map((_, i) => `${i + 1}`)
  },
  yAxis: {
    type: 'value',
    min: 0
  },
  series: [
    {
      data: runDurations.value,
      type: 'bar',
      smooth: true,
      color: '#1976d2',
      name: 'Run Duration'
    }
  ],
  tooltip: { trigger: 'axis' }
}));

onMounted(() => {
  runAllWithMetrics();
});
</script>
