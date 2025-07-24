<template>
  <div>
    <LayoutPageStructure
      title="Analytics Dashboard"
      subtitle="Monitor LLM performance and usage insights"
      back-button-to="/llm"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Key Metrics -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-2">
                  mdi-chart-line
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ metrics.totalRequests }}
                </div>
                <div class="text-body-2">
                  Total Requests
                </div>
                <div class="text-caption text-success">
                  +{{ metrics.requestGrowth }}% this month
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-2">
                  mdi-check-circle
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ metrics.successRate }}%
                </div>
                <div class="text-body-2">
                  Success Rate
                </div>
                <div class="text-caption text-success">
                  +{{ metrics.successGrowth }}% this month
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="warning" class="mb-2">
                  mdi-clock
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  {{ metrics.avgResponseTime }}ms
                </div>
                <div class="text-body-2">
                  Avg Response Time
                </div>
                <div class="text-caption text-success">
                  -{{ metrics.responseTimeImprovement }}% this month
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-2">
                  mdi-currency-usd
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  ${{ metrics.totalCost }}
                </div>
                <div class="text-body-2">
                  Total Cost
                </div>
                <div class="text-caption text-warning">
                  +{{ metrics.costGrowth }}% this month
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Charts Row -->
        <v-row class="mb-4">
          <v-col cols="12" md="8">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-chart-line
                </v-icon>
                Request Volume Over Time
              </v-card-title>
              <v-card-text>
                <div class="chart-container">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p>Request volume chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Daily request counts over the last 30 days
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-chart-pie
                </v-icon>
                Model Usage Distribution
              </v-card-title>
              <v-card-text>
                <div class="chart-container">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-pie
                    </v-icon>
                    <p>Model usage pie chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Distribution of requests across different models
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Performance Metrics -->
        <v-row class="mb-4">
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-speedometer
                </v-icon>
                Response Time by Model
              </v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item
                    v-for="model in performanceByModel"
                    :key="model.name"
                    class="px-0"
                  >
                    <template #prepend>
                      <v-icon color="primary">
                        mdi-brain
                      </v-icon>
                    </template>
                    <v-list-item-title>
                      {{ model.name }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ model.requests }} requests
                    </v-list-item-subtitle>
                    <template #append>
                      <div class="d-flex align-center">
                        <v-progress-linear
                          :model-value="model.avgResponseTime / 1000"
                          color="primary"
                          height="6"
                          rounded
                          class="mr-2"
                          style="width: 60px"
                        />
                        <span class="text-caption">{{ model.avgResponseTime }}ms</span>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-alert-circle
                </v-icon>
                Error Analysis
              </v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item
                    v-for="error in errorAnalysis"
                    :key="error.type"
                    class="px-0"
                  >
                    <template #prepend>
                      <v-icon :color="error.color">
                        mdi-alert-circle
                      </v-icon>
                    </template>
                    <v-list-item-title>
                      {{ error.type }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ error.description }}
                    </v-list-item-subtitle>
                    <template #append>
                      <v-chip
                        :color="error.color"
                        size="small"
                        variant="tonal"
                      >
                        {{ error.count }}
                      </v-chip>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Cost Analysis -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-currency-usd
            </v-icon>
            Cost Analysis
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <div class="mb-4">
                  <strong>Total Cost This Month:</strong> ${{ metrics.totalCost }}
                </div>
                <div class="mb-4">
                  <strong>Cost per Request:</strong> ${{ (metrics.totalCost / metrics.totalRequests).toFixed(4) }}
                </div>
                <div class="mb-4">
                  <strong>Most Expensive Model:</strong> {{ costAnalysis.mostExpensiveModel }}
                </div>
                <div class="mb-4">
                  <strong>Cost Trend:</strong>
                  <v-chip
                    :color="costAnalysis.trend === 'increasing' ? 'error' : 'success'"
                    size="small"
                    variant="tonal"
                    class="ml-2"
                  >
                    {{ costAnalysis.trend }}
                  </v-chip>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-center py-8">
                  <v-icon size="64" color="grey-lighten-1" class="mb-4">
                    mdi-chart-bar
                  </v-icon>
                  <p>Cost breakdown chart will be displayed here</p>
                  <p class="text-caption text-medium-emphasis">
                    Cost distribution by model and time period
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Recent Activity -->
        <v-card>
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-clock-outline
            </v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <v-timeline density="compact" align="start">
              <v-timeline-item
                v-for="activity in recentActivity"
                :key="activity.id"
                :dot-color="activity.color"
                size="small"
              >
                <div class="d-flex justify-space-between align-center">
                  <div>
                    <div class="font-weight-medium">
                      {{ activity.title }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ activity.description }}
                    </div>
                  </div>
                  <div class="text-caption">
                    {{ formatTimeAgo(activity.timestamp) }}
                  </div>
                </div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <LLMGuide page="analytics" />
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

// Reactive data
const metrics = ref({
  totalRequests: 15420,
  requestGrowth: 12.5,
  successRate: 98.7,
  successGrowth: 2.1,
  avgResponseTime: 245,
  responseTimeImprovement: 15.3,
  totalCost: 1247.50,
  costGrowth: 8.2
})

const performanceByModel = ref([
  {
    name: 'GPT-4 Fine-tuned',
    requests: 5420,
    avgResponseTime: 180
  },
  {
    name: 'BERT Classification',
    requests: 3890,
    avgResponseTime: 95
  },
  {
    name: 'T5 Summarization',
    requests: 2870,
    avgResponseTime: 320
  },
  {
    name: 'RoBERTa QA',
    requests: 3240,
    avgResponseTime: 156
  }
])

const errorAnalysis = ref([
  {
    type: 'Rate Limit Exceeded',
    description: 'Too many requests in a short time',
    count: 45,
    color: 'warning'
  },
  {
    type: 'Model Unavailable',
    description: 'Model temporarily offline',
    count: 12,
    color: 'error'
  },
  {
    type: 'Invalid Input',
    description: 'Malformed request data',
    count: 23,
    color: 'info'
  },
  {
    type: 'Timeout',
    description: 'Request timed out',
    count: 8,
    color: 'error'
  }
])

const costAnalysis = ref({
  mostExpensiveModel: 'GPT-4 Fine-tuned',
  trend: 'increasing'
})

const recentActivity = ref([
  {
    id: 1,
    title: 'High request volume detected',
    description: 'GPT-4 model received 500+ requests in the last hour',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    color: 'warning'
  },
  {
    id: 2,
    title: 'New model deployed',
    description: 'BERT Classification model successfully deployed',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    color: 'success'
  },
  {
    id: 3,
    title: 'Cost threshold reached',
    description: 'Monthly cost exceeded $1000 threshold',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    color: 'error'
  },
  {
    id: 4,
    title: 'Performance improvement',
    description: 'Average response time improved by 15%',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    color: 'success'
  }
])

const formatTimeAgo = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

onMounted(() => {
  // Load analytics data from API
      // Loading analytics data...
})
</script>

<style scoped>
.metric-card {
  transition: transform 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
}

.chart-container {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ensure all text is black */
:deep(.v-card-title) {
  color: black !important;
}

:deep(.v-card-text) {
  color: black !important;
}

:deep(.v-list-item-title) {
  color: black !important;
}

:deep(.v-list-item-subtitle) {
  color: rgba(0, 0, 0, 0.6) !important;
}

:deep(.v-chip) {
  color: black !important;
}

:deep(.v-timeline-item) {
  color: black !important;
}
</style> 