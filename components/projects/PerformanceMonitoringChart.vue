<template>
  <div class="performance-monitoring-chart">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-body-2 mt-4">Loading performance metrics...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="metrics.length === 0" class="text-center py-8">
      <v-icon icon="mdi-chart-line" size="48" class="mb-4 text-disabled" />
      <p class="text-body-1 text-disabled">No performance data available</p>
      <p class="text-body-2 text-disabled">Deploy a model to see performance metrics</p>
    </div>

    <!-- Performance Dashboard -->
    <div v-else class="performance-dashboard">
      <!-- Time Range Selector -->
      <div class="time-range-selector mb-4">
        <v-chip-group
          v-model="selectedTimeRange"
          mandatory
          selected-class="text-primary"
          @update:model-value="updateTimeRange"
        >
          <v-chip value="1h" size="small">1H</v-chip>
          <v-chip value="6h" size="small">6H</v-chip>
          <v-chip value="24h" size="small">24H</v-chip>
          <v-chip value="7d" size="small">7D</v-chip>
          <v-chip value="30d" size="small">30D</v-chip>
        </v-chip-group>
      </div>

      <!-- Key Metrics Cards -->
      <v-row class="mb-4">
        <v-col cols="6" md="3">
          <v-card variant="outlined" class="metric-card">
            <v-card-text class="text-center">
              <div class="metric-value text-success">{{ formatUptime(currentMetrics.uptime) }}</div>
              <div class="metric-label">Uptime</div>
              <div class="metric-trend">
                <v-icon :icon="uptimeTrend.icon" :color="uptimeTrend.color" size="12" />
                <span :class="`text-${uptimeTrend.color}`">{{ uptimeTrend.value }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card variant="outlined" class="metric-card">
            <v-card-text class="text-center">
              <div class="metric-value text-primary">{{ currentMetrics.avgResponseTime }}ms</div>
              <div class="metric-label">Avg Response</div>
              <div class="metric-trend">
                <v-icon :icon="responseTrend.icon" :color="responseTrend.color" size="12" />
                <span :class="`text-${responseTrend.color}`">{{ responseTrend.value }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card variant="outlined" class="metric-card">
            <v-card-text class="text-center">
              <div class="metric-value text-info">
                {{ formatNumber(currentMetrics.requestsPerMinute) }}
              </div>
              <div class="metric-label">Requests/min</div>
              <div class="metric-trend">
                <v-icon :icon="requestsTrend.icon" :color="requestsTrend.color" size="12" />
                <span :class="`text-${requestsTrend.color}`">{{ requestsTrend.value }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="6" md="3">
          <v-card variant="outlined" class="metric-card">
            <v-card-text class="text-center">
              <div class="metric-value text-warning">{{ currentMetrics.errorRate }}%</div>
              <div class="metric-label">Error Rate</div>
              <div class="metric-trend">
                <v-icon :icon="errorTrend.icon" :color="errorTrend.color" size="12" />
                <span :class="`text-${errorTrend.color}`">{{ errorTrend.value }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Charts Section -->
      <v-row>
        <!-- Response Time Chart -->
        <v-col cols="12" md="6">
          <v-card class="chart-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-speedometer" class="mr-2" />
              Response Time
            </v-card-title>
            <v-card-text>
              <div class="chart-placeholder">
                <svg viewBox="0 0 400 200" class="response-chart">
                  <defs>
                    <linearGradient
                      id="responseGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" style="stop-color: rgb(33, 150, 243); stop-opacity: 0.8" />
                      <stop
                        offset="100%"
                        style="stop-color: rgb(33, 150, 243); stop-opacity: 0.1"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 180 Q 50 120 100 140 T 200 100 T 300 80 T 400 60"
                    stroke="rgb(33, 150, 243)"
                    stroke-width="2"
                    fill="url(#responseGradient)"
                  />
                </svg>
                <div class="chart-overlay">
                  <p class="text-caption">Live response time monitoring</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Throughput Chart -->
        <v-col cols="12" md="6">
          <v-card class="chart-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-chart-bar" class="mr-2" />
              Throughput
            </v-card-title>
            <v-card-text>
              <div class="chart-placeholder">
                <svg viewBox="0 0 400 200" class="throughput-chart">
                  <defs>
                    <linearGradient
                      id="throughputGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" style="stop-color: rgb(76, 175, 80); stop-opacity: 0.8" />
                      <stop offset="100%" style="stop-color: rgb(76, 175, 80); stop-opacity: 0.1" />
                    </linearGradient>
                  </defs>
                  <rect
                    x="20"
                    y="160"
                    width="15"
                    height="40"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="40"
                    y="140"
                    width="15"
                    height="60"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="60"
                    y="120"
                    width="15"
                    height="80"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="80"
                    y="100"
                    width="15"
                    height="100"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="100"
                    y="130"
                    width="15"
                    height="70"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="120"
                    y="110"
                    width="15"
                    height="90"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="140"
                    y="90"
                    width="15"
                    height="110"
                    fill="url(#throughputGradient)"
                  />
                  <rect
                    x="160"
                    y="120"
                    width="15"
                    height="80"
                    fill="url(#throughputGradient)"
                  />
                </svg>
                <div class="chart-overlay">
                  <p class="text-caption">Requests per minute</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- System Resources -->
        <v-col cols="12">
          <v-card class="chart-card">
            <v-card-title class="d-flex align-center">
              <v-icon icon="mdi-memory" class="mr-2" />
              System Resources
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <div class="resource-meter">
                    <div class="resource-label">CPU Usage</div>
                    <v-progress-circular
                      :model-value="currentMetrics.cpuUsage"
                      size="80"
                      width="8"
                      color="primary"
                      class="resource-circle"
                    >
                      <span class="text-h6">{{ currentMetrics.cpuUsage }}%</span>
                    </v-progress-circular>
                  </div>
                </v-col>
                <v-col cols="12" md="4">
                  <div class="resource-meter">
                    <div class="resource-label">Memory Usage</div>
                    <v-progress-circular
                      :model-value="currentMetrics.memoryUsage"
                      size="80"
                      width="8"
                      color="success"
                      class="resource-circle"
                    >
                      <span class="text-h6">{{ currentMetrics.memoryUsage }}%</span>
                    </v-progress-circular>
                  </div>
                </v-col>
                <v-col cols="12" md="4">
                  <div class="resource-meter">
                    <div class="resource-label">Disk Usage</div>
                    <v-progress-circular
                      :model-value="currentMetrics.diskUsage"
                      size="80"
                      width="8"
                      color="warning"
                      class="resource-circle"
                    >
                      <span class="text-h6">{{ currentMetrics.diskUsage }}%</span>
                    </v-progress-circular>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PerformanceMetrics } from '@/types/project';

interface Props {
  metrics: PerformanceMetrics[];
  timeRange?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  timeRange: '24h',
  loading: false,
});

const emit = defineEmits<{
  'time-range-change': [timeRange: string];
}>();

const selectedTimeRange = ref(props.timeRange);

// Mock current metrics (in real app, this would be computed from props.metrics)
const currentMetrics = ref({
  uptime: 99.8,
  avgResponseTime: 45,
  requestsPerMinute: 1247,
  errorRate: 0.12,
  cpuUsage: 68,
  memoryUsage: 74,
  diskUsage: 45,
});

// Mock trend data
const uptimeTrend = computed(() => ({
  icon: 'mdi-trending-up',
  color: 'success',
  value: '+0.2%',
}));

const responseTrend = computed(() => ({
  icon: 'mdi-trending-down',
  color: 'success',
  value: '-5ms',
}));

const requestsTrend = computed(() => ({
  icon: 'mdi-trending-up',
  color: 'success',
  value: '+12%',
}));

const errorTrend = computed(() => ({
  icon: 'mdi-trending-down',
  color: 'success',
  value: '-0.05%',
}));

const formatUptime = (uptime: number) => {
  return `${uptime.toFixed(1)}%`;
};

const formatNumber = (num: number) => {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
};

const updateTimeRange = (timeRange: string) => {
  emit('time-range-change', timeRange);
};

// Simulate real-time updates
onMounted(() => {
  const interval = setInterval(() => {
    // Simulate slight variations in metrics
    currentMetrics.value = {
      uptime: Math.max(
        99,
        Math.min(100, currentMetrics.value.uptime + (Math.random() - 0.5) * 0.1),
      ),
      avgResponseTime: Math.max(
        30,
        Math.min(80, currentMetrics.value.avgResponseTime + (Math.random() - 0.5) * 5),
      ),
      requestsPerMinute: Math.max(
        1000,
        Math.min(2000, currentMetrics.value.requestsPerMinute + (Math.random() - 0.5) * 100),
      ),
      errorRate: Math.max(
        0,
        Math.min(1, currentMetrics.value.errorRate + (Math.random() - 0.5) * 0.05),
      ),
      cpuUsage: Math.max(
        50,
        Math.min(90, currentMetrics.value.cpuUsage + (Math.random() - 0.5) * 5),
      ),
      memoryUsage: Math.max(
        60,
        Math.min(90, currentMetrics.value.memoryUsage + (Math.random() - 0.5) * 3),
      ),
      diskUsage: Math.max(
        40,
        Math.min(60, currentMetrics.value.diskUsage + (Math.random() - 0.5) * 2),
      ),
    };
  }, 5000);

  onBeforeUnmount(() => {
    clearInterval(interval);
  });
});
</script>

<style scoped>
.performance-monitoring-chart {
  min-height: 400px;
}

.time-range-selector {
  display: flex;
  justify-content: center;
}

.metric-card {
  height: 120px;
  transition: all 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.metric-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 4px;
}

.metric-trend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 0.75rem;
}

.chart-card {
  height: 280px;
}

.chart-placeholder {
  position: relative;
  height: 200px;
  background: rgba(var(--v-theme-surface), 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.chart-placeholder svg {
  width: 100%;
  height: 100%;
}

.chart-overlay {
  position: absolute;
  bottom: 8px;
  left: 8px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.resource-meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.resource-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.resource-circle {
  position: relative;
}

.resource-circle span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
}

@media (max-width: 768px) {
  .metric-value {
    font-size: 1.5rem;
  }

  .chart-card {
    height: auto;
    min-height: 240px;
  }

  .resource-meter {
    margin-bottom: 24px;
  }
}
</style>
