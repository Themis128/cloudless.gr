import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

export interface ChartData {
  title: string
  value: number
  subtitle: string
  percentage: number
  color: string
}

export interface ChartOptions {
  width?: string | number
  height?: string | number
  theme?: string
}

export const useCharts = () => {
  const chartInstances = ref<Map<string, echarts.ECharts>>(new Map())

  // Create a donut chart for metrics
  const createDonutChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    const chart = echarts.init(element, options.theme)
    
    const option = {
      title: {
        text: data.title,
        left: 'center',
        top: '10%',
        textStyle: {
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
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
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold',
              color: '#ffffff'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            {
              value: data.value,
              name: data.subtitle,
              itemStyle: {
                color: data.color
              }
            },
            {
              value: 100 - data.value,
              name: 'Remaining',
              itemStyle: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            }
          ]
        }
      ]
    }

    chart.setOption(option)
    return chart
  }

  // Create a progress bar chart
  const createProgressChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    const chart = echarts.init(element, options.theme)
    
    const option = {
      title: {
        text: data.title,
        left: 'center',
        top: '5%',
        textStyle: {
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c}%'
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '30%',
        bottom: '10%'
      },
      xAxis: {
        type: 'category',
        data: ['Progress'],
        axisLabel: {
          color: '#ffffff'
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: '#ffffff',
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: data.subtitle,
          type: 'bar',
          data: [data.percentage],
          itemStyle: {
            color: data.color,
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'top',
            formatter: `${data.value}\n${data.subtitle}`,
            color: '#ffffff',
            fontSize: 12
          }
        }
      ]
    }

    chart.setOption(option)
    return chart
  }

  // Create a gauge chart for system health
  const createGaugeChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    const chart = echarts.init(element, options.theme)
    
    const option = {
      title: {
        text: data.title,
        left: 'center',
        top: '10%',
        textStyle: {
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        formatter: '{a} <br/>{b} : {c}%'
      },
      series: [
        {
          name: data.subtitle,
          type: 'gauge',
          progress: {
            show: true,
            width: 18
          },
          axisLine: {
            lineStyle: {
              width: 18
            }
          },
          axisTick: {
            show: false
          },
          splitLine: {
            length: 15,
            lineStyle: {
              width: 2,
              color: '#999'
            }
          },
          axisLabel: {
            distance: 25,
            color: '#ffffff',
            fontSize: 12
          },
          anchor: {
            show: true,
            showAbove: true,
            size: 25,
            itemStyle: {
              borderWidth: 10
            }
          },
          title: {
            show: false
          },
          detail: {
            valueAnimation: true,
            fontSize: 20,
            offsetCenter: [0, '70%'],
            formatter: `${data.value}\n${data.subtitle}`,
            color: '#ffffff'
          },
          data: [
            {
              value: data.percentage,
              name: data.subtitle,
              itemStyle: {
                color: data.color
              }
            }
          ]
        }
      ]
    }

    chart.setOption(option)
    return chart
  }

  // Create a mini line chart for trends
  const createTrendChart = (
    element: HTMLElement,
    data: ChartData,
    options: ChartOptions = {}
  ) => {
    const chart = echarts.init(element, options.theme)
    
    // Generate sample trend data
    const trendData = Array.from({ length: 7 }, (_, i) => {
      const baseValue = data.percentage
      const variation = Math.random() * 20 - 10
      return Math.max(0, Math.min(100, baseValue + variation))
    })
    
    const option = {
      title: {
        text: data.title,
        left: 'center',
        top: '5%',
        textStyle: {
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: '{b}: {c}%'
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '25%',
        bottom: '15%'
      },
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisLabel: {
          color: '#ffffff',
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: '#ffffff',
          fontSize: 10,
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: data.subtitle,
          type: 'line',
          data: trendData,
          smooth: true,
          lineStyle: {
            color: data.color,
            width: 3
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
                  color: data.color
                },
                {
                  offset: 1,
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              ]
            }
          },
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: {
            color: data.color
          }
        }
      ]
    }

    chart.setOption(option)
    return chart
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

  // Add chart instance to tracking
  const addChart = (id: string, chart: echarts.ECharts) => {
    chartInstances.value.set(id, chart)
  }

  // Remove chart instance from tracking
  const removeChart = (id: string) => {
    const chart = chartInstances.value.get(id)
    if (chart) {
      chart.dispose()
      chartInstances.value.delete(id)
    }
  }

  // Handle window resize
  onMounted(() => {
    window.addEventListener('resize', resizeCharts)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resizeCharts)
    disposeCharts()
  })

  return {
    createDonutChart,
    createProgressChart,
    createGaugeChart,
    createTrendChart,
    addChart,
    removeChart,
    resizeCharts,
    disposeCharts
  }
} 