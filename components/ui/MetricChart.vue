<template>
  <div class="metric-chart-container">
    <ClientOnly>
      <div
        ref="chartElement"
        :id="chartId"
        :class="chartClass"
        :style="{ width: width, height: height }"
      >
        <!-- Fallback content if chart fails to load -->
        <div v-if="chartError" class="chart-fallback">
          <div class="chart-fallback-content">
            <div class="chart-fallback-value">{{ data.value }}</div>
            <div class="chart-fallback-label">{{ data.subtitle }}</div>
          </div>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useCharts } from '~/composables/useCharts'
import type { ChartData } from '~/types/common'

interface Props {
  data: ChartData
  type: 'donut' | 'progress' | 'gauge' | 'trend'
  width?: string | number
  height?: string | number
  theme?: string
  chartId?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '200px',
  theme: 'dark',
  chartId: () => `chart-${Math.random().toString(36).substr(2, 9)}`,
})

const {
  createDonutChart,
  createProgressChart,
  createGaugeChart,
  createTrendChart,
  addChart,
  removeChart,
} = useCharts()

const chartElement = ref<HTMLElement | null>(null)
const chartInstance = ref<any>(null)
const chartError = ref(false)

const chartClass = computed(() => {
  return `metric-chart metric-chart-${props.type}`
})

const createChart = () => {
  // Only run on client side
  if (!process.client) return

  // Don't create charts if component is being unmounted
  if (!chartElement.value && !document.getElementById(props.chartId)) {
    return
  }

  try {
    // Use the ref directly if available, otherwise fall back to getElementById
    let element = chartElement.value

    if (!element) {
      element = document.getElementById(props.chartId)
    }

    if (!element) {
      // Don't log warnings for chart elements that might not be ready yet
      // This is normal during component mounting/unmounting
      // Return silently to avoid console warnings
      return
    }

    // Remove existing chart
    if (chartInstance.value) {
      removeChart(props.chartId)
    }

    // Create new chart based on type
    switch (props.type) {
      case 'donut':
        chartInstance.value = createDonutChart(element, props.data, {
          width: props.width,
          height: props.height,
          theme: props.theme,
        })
        break
      case 'progress':
        chartInstance.value = createProgressChart(element, props.data, {
          width: props.width,
          height: props.height,
          theme: props.theme,
        })
        break
      case 'gauge':
        chartInstance.value = createGaugeChart(element, props.data, {
          width: props.width,
          height: props.height,
          theme: props.theme,
        })
        break
      case 'trend':
        chartInstance.value = createTrendChart(element, props.data, {
          width: props.width,
          height: props.height,
          theme: props.theme,
        })
        break
      default:
        console.warn('Unknown chart type:', props.type)
        return
    }

    // Add chart to tracking
    if (chartInstance.value) {
      addChart(props.chartId, chartInstance.value)
      chartError.value = false
    }
  } catch (error) {
    console.error('Error creating chart:', error)
    chartError.value = true
  }
}

// Watch for data changes
watch(
  () => props.data,
  () => {
    if (process.client) {
      nextTick(() => {
        createChart()
      })
    }
  },
  { deep: true }
)

// Watch for type changes
watch(
  () => props.type,
  () => {
    if (process.client) {
      nextTick(() => {
        createChart()
      })
    }
  }
)

onMounted(() => {
  if (process.client) {
    nextTick(() => {
      // Wait for DOM to be fully ready and ensure element exists
      setTimeout(() => {
        if (chartElement.value || document.getElementById(props.chartId)) {
          createChart()
        } else {
          // If element still doesn't exist, try again after a longer delay
          setTimeout(() => {
            createChart()
          }, 200)
        }
      }, 100)
    })
  }
})

onUnmounted(() => {
  removeChart(props.chartId)
})
</script>

<style scoped>
.metric-chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-chart {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.metric-chart-donut {
  min-height: 200px;
}

.metric-chart-progress {
  min-height: 150px;
}

.metric-chart-gauge {
  min-height: 200px;
}

.metric-chart-trend {
  min-height: 180px;
}

.chart-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.chart-fallback-content {
  text-align: center;
  color: white;
}

.chart-fallback-value {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.chart-fallback-label {
  font-size: 0.875rem;
  opacity: 0.8;
}
</style>
