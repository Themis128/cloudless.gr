import * as echarts from 'echarts'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChartData, ChartOptions } from '~/types/common'

export const useChartsStore = defineStore('charts', () => {
  // State
  const chartInstances = ref<Map<string, echarts.ECharts>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Create a donut chart for metrics
  const createDonutChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    try {
      const chart = echarts.init(element, options.theme)

      const option = {
        title: {
          text: data.title,
          left: 'center',
          top: '10%',
          textStyle: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)',
        },
        series: [
          {
            name: data.title,
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '60%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2,
            },
            label: {
              show: false,
              position: 'center',
            },
            emphasis: {
              label: {
                show: true,
                fontSize: '18',
                fontWeight: 'bold',
                color: '#ffffff',
              },
            },
            labelLine: {
              show: false,
            },
            data: [
              {
                value: data.value,
                name: data.subtitle,
                itemStyle: {
                  color: data.color,
                },
              },
              {
                value: 100 - data.value,
                name: 'Remaining',
                itemStyle: {
                  color: 'rgba(255, 255, 255, 0.1)',
                },
              },
            ],
          },
        ],
      }

      chart.setOption(option)
      return chart
    } catch (err: any) {
      console.error('Error creating donut chart:', err)
      setError(err.message || 'Failed to create donut chart')
      return null
    }
  }

  // Create a progress bar chart
  const createProgressChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    try {
      const chart = echarts.init(element, options.theme)

      const option = {
        title: {
          text: data.title,
          left: 'center',
          top: '10%',
          textStyle: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          trigger: 'axis',
          formatter: '{b}: {c}%',
        },
        xAxis: {
          type: 'category',
          data: [data.subtitle],
          axisLabel: {
            color: '#ffffff',
          },
        },
        yAxis: {
          type: 'value',
          max: 100,
          axisLabel: {
            color: '#ffffff',
            formatter: '{value}%',
          },
        },
        series: [
          {
            name: data.title,
            type: 'bar',
            data: [data.value],
            itemStyle: {
              color: data.color,
              borderRadius: [0, 4, 4, 0],
            },
            label: {
              show: true,
              position: 'top',
              formatter: '{c}%',
              color: '#ffffff',
            },
          },
        ],
      }

      chart.setOption(option)
      return chart
    } catch (err: any) {
      console.error('Error creating progress chart:', err)
      setError(err.message || 'Failed to create progress chart')
      return null
    }
  }

  // Create a gauge chart
  const createGaugeChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    try {
      const chart = echarts.init(element, options.theme)

      const option = {
        title: {
          text: data.title,
          left: 'center',
          top: '10%',
          textStyle: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          formatter: '{a} <br/>{b} : {c}%',
        },
        series: [
          {
            name: data.subtitle,
            type: 'gauge',
            progress: {
              show: true,
              width: 18,
            },
            axisLine: {
              lineStyle: {
                width: 18,
              },
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              length: 15,
              lineStyle: {
                width: 2,
                color: '#999',
              },
            },
            axisLabel: {
              distance: 25,
              color: '#999',
              fontSize: 12,
            },
            anchor: {
              show: true,
              showAbove: true,
              size: 25,
              itemStyle: {
                borderWidth: 10,
              },
            },
            title: {
              show: false,
            },
            detail: {
              valueAnimation: true,
              fontSize: 30,
              offsetCenter: [0, '70%'],
              formatter: '{value}%',
              color: '#ffffff',
            },
            data: [
              {
                value: data.value,
                name: data.subtitle,
                itemStyle: {
                  color: data.color,
                },
              },
            ],
          },
        ],
      }

      chart.setOption(option)
      return chart
    } catch (err: any) {
      console.error('Error creating gauge chart:', err)
      setError(err.message || 'Failed to create gauge chart')
      return null
    }
  }

  // Create a trend chart
  const createTrendChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    try {
      const chart = echarts.init(element, options.theme)

      const option = {
        title: {
          text: data.title,
          left: 'center',
          top: '10%',
          textStyle: {
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        tooltip: {
          trigger: 'axis',
        },
        xAxis: {
          type: 'category',
          data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          axisLabel: {
            color: '#ffffff',
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: '#ffffff',
          },
        },
        series: [
          {
            name: data.subtitle,
            type: 'line',
            data: [30, 45, 60, 75, 85, data.value],
            smooth: true,
            lineStyle: {
              color: data.color,
              width: 3,
            },
            itemStyle: {
              color: data.color,
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: data.color,
                  },
                  {
                    offset: 1,
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                ],
              },
            },
          },
        ],
      }

      chart.setOption(option)
      return chart
    } catch (err: any) {
      console.error('Error creating trend chart:', err)
      setError(err.message || 'Failed to create trend chart')
      return null
    }
  }

  // Resize all charts
  const resizeCharts = () => {
    chartInstances.value.forEach(chart => {
      chart.resize()
    })
  }

  // Dispose all charts
  const disposeCharts = () => {
    chartInstances.value.forEach(chart => {
      chart.dispose()
    })
    chartInstances.value.clear()
  }

  // Add chart to instances
  const addChart = (id: string, chart: echarts.ECharts) => {
    chartInstances.value.set(id, chart)
  }

  // Remove chart from instances
  const removeChart = (id: string) => {
    const chart = chartInstances.value.get(id)
    if (chart) {
      chart.dispose()
      chartInstances.value.delete(id)
    }
  }

  // Get chart by ID
  const getChart = (id: string) => {
    return chartInstances.value.get(id)
  }

  // Set loading state
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  // Set error state
  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    chartInstances,
    isLoading,
    error,

    // Methods
    createDonutChart,
    createProgressChart,
    createGaugeChart,
    createTrendChart,
    resizeCharts,
    disposeCharts,
    addChart,
    removeChart,
    getChart,
    setLoading,
    setError,
    clearError,
  }
})
