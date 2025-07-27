import { computed } from 'vue'
import type { ChartData, ChartOptions } from '~/types/common'

// Composable that uses the Pinia store
export const useCharts = () => {
  const chartsStore = useChartsStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    chartInstances: computed(() => chartsStore.chartInstances),
    isLoading: computed(() => chartsStore.isLoading),
    error: computed(() => chartsStore.error),

    // Methods (delegate to store)
    createDonutChart: chartsStore.createDonutChart,
    createProgressChart: chartsStore.createProgressChart,
    createGaugeChart: chartsStore.createGaugeChart,
    createTrendChart: chartsStore.createTrendChart,
    resizeCharts: chartsStore.resizeCharts,
    disposeCharts: chartsStore.disposeCharts,
    addChart: chartsStore.addChart,
    removeChart: chartsStore.removeChart,
    getChart: chartsStore.getChart,
    setLoading: chartsStore.setLoading,
    setError: chartsStore.setError,
    clearError: chartsStore.clearError,
  }
}
