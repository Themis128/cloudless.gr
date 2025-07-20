<template>
  <div>
    <PageStructure
      title="Cost Analysis"
      subtitle="Track and analyze your LLM usage costs"
      back-button-to="/llm/analytics"
      :has-sidebar="true"
      :white-header="true"
    >
      <template #main>
        <!-- Cost Overview -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="primary" class="mb-2">
                  mdi-currency-usd
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  ${{ costMetrics.totalCost }}
                </div>
                <div class="text-body-2">
                  Total Cost
                </div>
                <div class="text-caption text-warning">
                  +{{ costMetrics.costGrowth }}% this month
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="success" class="mb-2">
                  mdi-chart-line
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  ${{ costMetrics.avgCostPerRequest }}
                </div>
                <div class="text-body-2">
                  Avg Cost/Request
                </div>
                <div class="text-caption text-success">
                  -{{ costMetrics.costReduction }}% this month
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
                  ${{ costMetrics.dailyAverage }}
                </div>
                <div class="text-body-2">
                  Daily Average
                </div>
                <div class="text-caption text-info">
                  Last 30 days
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card class="metric-card">
              <v-card-text class="text-center">
                <v-icon size="48" color="info" class="mb-2">
                  mdi-target
                </v-icon>
                <div class="text-h4 font-weight-bold">
                  ${{ costMetrics.budget }}
                </div>
                <div class="text-body-2">
                  Monthly Budget
                </div>
                <div class="text-caption" :class="costMetrics.budgetUsage > 80 ? 'text-error' : 'text-success'">
                  {{ costMetrics.budgetUsage }}% used
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Cost Charts -->
        <v-row class="mb-4">
          <v-col cols="12" md="8">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-chart-line
                </v-icon>
                Cost Trend Over Time
              </v-card-title>
              <v-card-text>
                <div class="chart-container">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-line
                    </v-icon>
                    <p>Cost trend chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Daily cost tracking over the last 30 days
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
                Cost by Model
              </v-card-title>
              <v-card-text>
                <div class="chart-container">
                  <div class="text-center py-8">
                    <v-icon size="64" color="grey-lighten-1" class="mb-4">
                      mdi-chart-pie
                    </v-icon>
                    <p>Cost distribution pie chart will be displayed here</p>
                    <p class="text-caption text-medium-emphasis">
                      Cost breakdown by model type
                    </p>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Cost Breakdown -->
        <v-row class="mb-4">
          <v-col cols="12" md="6">
            <v-card>
              <v-card-title class="text-h6">
                <v-icon start color="primary">
                  mdi-brain
                </v-icon>
                Cost by Model
              </v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item
                    v-for="model in costByModel"
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
                          :model-value="(model.cost / costMetrics.totalCost) * 100"
                          color="primary"
                          height="6"
                          rounded
                          class="mr-2"
                          style="width: 60px"
                        />
                        <span class="text-caption">${{ model.cost }}</span>
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
                  mdi-calendar
                </v-icon>
                Cost by Day
              </v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item
                    v-for="day in costByDay"
                    :key="day.date"
                    class="px-0"
                  >
                    <template #prepend>
                      <v-icon color="info">
                        mdi-calendar
                      </v-icon>
                    </template>
                    <v-list-item-title>
                      {{ formatDate(day.date) }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      {{ day.requests }} requests
                    </v-list-item-subtitle>
                    <template #append>
                      <span class="text-caption">${{ day.cost }}</span>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Cost Optimization -->
        <v-card class="mb-4">
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-lightbulb
            </v-icon>
            Cost Optimization Suggestions
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-alert
                  type="info"
                  variant="tonal"
                  class="mb-3"
                >
                  <strong>Model Selection:</strong> Consider using smaller models for simple tasks to reduce costs by up to 60%.
                </v-alert>
                <v-alert
                  type="warning"
                  variant="tonal"
                  class="mb-3"
                >
                  <strong>Request Optimization:</strong> Batch similar requests together to reduce API calls and costs.
                </v-alert>
              </v-col>
              <v-col cols="12" md="6">
                <v-alert
                  type="success"
                  variant="tonal"
                  class="mb-3"
                >
                  <strong>Caching:</strong> Implement response caching for repeated queries to save on API costs.
                </v-alert>
                <v-alert
                  type="info"
                  variant="tonal"
                  class="mb-3"
                >
                  <strong>Budget Alerts:</strong> Set up spending alerts to monitor costs and avoid unexpected charges.
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Detailed Cost Table -->
        <v-card>
          <v-card-title class="text-h6">
            <v-icon start color="primary">
              mdi-table
            </v-icon>
            Detailed Cost Breakdown
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="costHeaders"
              :items="detailedCosts"
              class="elevation-0"
              :items-per-page="10"
              :items-per-page-options="[5, 10, 25, 50]"
            >
              <template #item.model="{ item }">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">
                    mdi-brain
                  </v-icon>
                  {{ item.model }}
                </div>
              </template>

              <template #item.cost="{ item }">
                <span class="font-weight-medium">${{ item.cost }}</span>
              </template>

              <template #item.costPerRequest="{ item }">
                <span class="text-caption">${{ item.costPerRequest }}</span>
              </template>

              <template #item.trend="{ item }">
                <v-chip
                  :color="item.trend === 'increasing' ? 'error' : 'success'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.trend }}
                </v-chip>
              </template>

              <template #item.actions="{ item }">
                <div class="d-flex gap-1">
                  <v-btn
                    icon="mdi-chart-line"
                    size="small"
                    variant="text"
                    color="primary"
                    @click="() => viewModelCosts(item)"
                  />
                  <v-btn
                    icon="mdi-download"
                    size="small"
                    variant="text"
                    color="success"
                    @click="() => downloadCostData(item)"
                  />
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </template>

      <template #sidebar>
        <LLMGuide page="analytics" />
      </template>
    </PageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageStructure from '~/components/layout/PageStructure.vue'
import LLMGuide from '~/components/step-guides/LLMGuide.vue'

// Cost metrics
const costMetrics = ref({
  totalCost: 1247.50,
  costGrowth: 8.2,
  avgCostPerRequest: 0.081,
  costReduction: 12.5,
  dailyAverage: 41.58,
  budget: 2000,
  budgetUsage: 62.4
})

const costByModel = ref([
  {
    name: 'GPT-4 Fine-tuned',
    requests: 5420,
    cost: 542.00
  },
  {
    name: 'BERT Classification',
    requests: 3890,
    cost: 194.50
  },
  {
    name: 'T5 Summarization',
    requests: 2870,
    cost: 287.00
  },
  {
    name: 'RoBERTa QA',
    requests: 3240,
    cost: 224.00
  }
])

const costByDay = ref([
  { date: '2024-01-15', requests: 1250, cost: 45.20 },
  { date: '2024-01-14', requests: 1180, cost: 42.80 },
  { date: '2024-01-13', requests: 1320, cost: 48.50 },
  { date: '2024-01-12', requests: 980, cost: 35.60 },
  { date: '2024-01-11', requests: 1450, cost: 52.30 }
])

const detailedCosts = ref([
  {
    model: 'GPT-4 Fine-tuned',
    requests: 5420,
    cost: 542.00,
    costPerRequest: 0.100,
    avgResponseTime: 180,
    trend: 'increasing'
  },
  {
    model: 'BERT Classification',
    requests: 3890,
    cost: 194.50,
    costPerRequest: 0.050,
    avgResponseTime: 95,
    trend: 'decreasing'
  },
  {
    model: 'T5 Summarization',
    requests: 2870,
    cost: 287.00,
    costPerRequest: 0.100,
    avgResponseTime: 320,
    trend: 'stable'
  },
  {
    model: 'RoBERTa QA',
    requests: 3240,
    cost: 224.00,
    costPerRequest: 0.069,
    avgResponseTime: 156,
    trend: 'decreasing'
  }
])

const costHeaders = [
  { title: 'Model', key: 'model', sortable: true },
  { title: 'Requests', key: 'requests', sortable: true },
  { title: 'Total Cost', key: 'cost', sortable: true },
  { title: 'Cost/Request', key: 'costPerRequest', sortable: true },
  { title: 'Avg Response Time', key: 'avgResponseTime', sortable: true },
  { title: 'Trend', key: 'trend', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString()
}

const viewModelCosts = (item: any) => {
  // In a real app, this would navigate to detailed model cost view
  console.log('Viewing costs for:', item.model)
}

const downloadCostData = (item: any) => {
  // In a real app, this would download cost data
  const data = {
    model: item.model,
    costData: item,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cost-data-${item.model.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
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

.gap-1 {
  gap: 0.25rem;
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

:deep(.v-data-table) {
  color: black !important;
}

:deep(.v-data-table th) {
  color: black !important;
}

:deep(.v-data-table td) {
  color: black !important;
}

:deep(.v-alert) {
  color: black !important;
}

:deep(.v-btn) {
  color: black !important;
}
</style> 