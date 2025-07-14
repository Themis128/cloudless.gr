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
          <v-card-title class="text-h5">System Logs</v-card-title>
          <v-card-text>
            <DebugLogsViewer :logs="systemLogs" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Log Metrics</v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Total Logs:</v-list-item-title>
                        <v-list-item-subtitle>{{ systemLogs.length }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Last Log:</v-list-item-title>
                        <v-list-item-subtitle>{{ lastLog }}</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Log Frequency (Last 7 Events)</v-card-title>
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
import VChart from 'vue-echarts';

const systemLogs = ref<string[]>([
  'Service started...',
  'Connection established...',
  'Auth token refreshed.'
]);

onMounted(() => {
  // Simulate dynamic log update
  systemLogs.value.push('Log viewer initialized.');
});

const lastLog = computed(() => systemLogs.value[systemLogs.value.length - 1] || 'N/A');
const lastUpdated = computed(() => new Date().toLocaleString());
const diagnosticStatus = computed(() => systemLogs.value.length > 0 ? 'Healthy' : 'No logs');

const logCounts = computed(() => {
  // Simulate log frequency for last 7 events
  const arr = new Array(7).fill(0);
  for (let i = 0; i < Math.min(systemLogs.value.length, 7); i++) {
    arr[i] = 1 + Math.floor(Math.random() * 3); // Random count for demo
  }
  return arr;
});

const chartOptions = computed(() => ({
  xAxis: {
    type: 'category',
    data: ['1', '2', '3', '4', '5', '6', '7']
  },
  yAxis: {
    type: 'value',
    min: 0
  },
  series: [
    {
      data: logCounts.value,
      type: 'bar',
      smooth: true,
      color: '#43a047',
      name: 'Logs'
    }
  ],
  tooltip: { trigger: 'axis' }
}));
</script>
