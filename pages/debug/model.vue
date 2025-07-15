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
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-h5">Test Model Inference</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="input"
              label="Input for inference"
              @keyup.enter="runInference"
              append-inner-icon="mdi-play"
              @click:append-inner="runInference"
            />
            <DebugConsole :output="logs" title="Model Output" />
            <v-divider class="my-4" />
            <v-row>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Inference Metrics</v-card-title>
                  <v-card-text>
                    <v-list dense>
                      <v-list-item>
                        <v-list-item-title>Total Inferences:</v-list-item-title>
                        <v-list-item-subtitle>{{ inferenceTimes.length }}</v-list-item-subtitle>
                      </v-list-item>
                      <v-list-item>
                        <v-list-item-title>Last Inference Time:</v-list-item-title>
                        <v-list-item-subtitle>{{ lastInferenceTime }} ms</v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card outlined>
                  <v-card-title class="text-h6">Inference Times (ms)</v-card-title>
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
          <v-card-title class="text-h6">Model Details</v-card-title>
          <v-card-text>
            <DebugInspector :data="modelInfo" />
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
import { ref, onMounted, computed } from 'vue';
import DebugConsole from '~/components/debug/DebugConsole.vue';
import DebugInspector from '~/components/debug/DebugInspector.vue';
import VChart from 'vue-echarts';
import { useDebugTools } from '~/composables/useDebugTools';

const { logs } = useDebugTools();

const input = ref('');
const modelInfo = ref({ version: 'v1.2', status: 'ready', params: { layers: 12, size: '1.3B' } });
const inferenceTimes = ref<number[]>([]);
const lastUpdated = computed(() => new Date().toLocaleString());
const diagnosticStatus = computed(() => modelInfo.value.status);

onMounted(() => {
  modelInfo.value.status = 'warming up...';
  setTimeout(() => {
    modelInfo.value.status = 'ready';
  }, 1000);
});

function runInference() {
  const start = Date.now();
  if (input.value) {
    logs.value.push(`Echo: ${input.value}`);
  }
  setTimeout(() => {
    const elapsed = Date.now() - start;
    inferenceTimes.value.push(elapsed);
  }, 100 + Math.random() * 200);
  input.value = '';
}

const lastInferenceTime = computed(() => {
  if (inferenceTimes.value.length === 0) return 'N/A';
  return inferenceTimes.value[inferenceTimes.value.length - 1];
});

const chartOptions = computed(() => ({
  xAxis: {
    type: 'category',
    data: inferenceTimes.value.map((_, i) => `${i + 1}`)
  },
  yAxis: {
    type: 'value',
    min: 0
  },
  series: [
    {
      data: inferenceTimes.value,
      type: 'line',
      smooth: true,
      color: '#1976d2',
      name: 'Inference Time'
    }
  ],
  tooltip: { trigger: 'axis' }
}));
</script>
