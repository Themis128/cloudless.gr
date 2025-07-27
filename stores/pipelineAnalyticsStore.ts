import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface PipelineStats {
  totalPipelines: number
  activePipelines: number
  completedPipelines: number
  failedPipelines: number
  averageExecutionTime: number
  successRate: number
}

interface PipelineExecution {
  id: string
  pipelineId: string
  pipelineName: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startTime: string
  endTime?: string
  duration?: number
  steps: PipelineStep[]
  metadata?: Record<string, any>
}

interface PipelineStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
  duration?: number
  output?: any
  error?: string
}

interface PerformanceMetric {
  date: string
  executions: number
  successRate: number
  averageDuration: number
  failedExecutions: number
}

export const usePipelineAnalyticsStore = defineStore(
  'pipelineAnalytics',
  () => {
    // State
    const pipelineStats = ref<PipelineStats>({
      totalPipelines: 0,
      activePipelines: 0,
      completedPipelines: 0,
      failedPipelines: 0,
      averageExecutionTime: 0,
      successRate: 0,
    })

    const recentExecutions = ref<PipelineExecution[]>([])
    const performanceMetrics = ref<PerformanceMetric[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    // Computed properties
    const activeExecutionCount = computed(
      () =>
        recentExecutions.value.filter(exec => exec.status === 'running').length
    )

    const failedExecutionCount = computed(
      () =>
        recentExecutions.value.filter(exec => exec.status === 'failed').length
    )

    const averageExecutionDuration = computed(() => {
      const completedExecutions = recentExecutions.value.filter(
        exec => exec.duration
      )
      if (completedExecutions.length === 0) return 0

      const totalDuration = completedExecutions.reduce(
        (sum, exec) => sum + (exec.duration || 0),
        0
      )
      return Math.round(totalDuration / completedExecutions.length)
    })

    const successRatePercentage = computed(() => {
      if (pipelineStats.value.totalPipelines === 0) return 0
      return Math.round(
        (pipelineStats.value.completedPipelines /
          pipelineStats.value.totalPipelines) *
          100
      )
    })

    // Actions
    const fetchPipelineStats = async () => {
      isLoading.value = true
      error.value = null

      try {
        const response = await $fetch('/api/pipelines/analytics/stats')
        pipelineStats.value = response as PipelineStats
      } catch (err: any) {
        error.value = err.message || 'Failed to fetch pipeline statistics'
        console.error('Error fetching pipeline stats:', err)
      } finally {
        isLoading.value = false
      }
    }

    const fetchRecentExecutions = async (limit: number = 20) => {
      isLoading.value = true
      error.value = null

      try {
        const response = await $fetch(
          `/api/pipelines/analytics/executions?limit=${limit}`
        )
        recentExecutions.value = response as PipelineExecution[]
      } catch (err: any) {
        error.value = err.message || 'Failed to fetch recent executions'
        console.error('Error fetching recent executions:', err)
      } finally {
        isLoading.value = false
      }
    }

    const fetchPerformanceMetrics = async (days: number = 30) => {
      isLoading.value = true
      error.value = null

      try {
        const response = await $fetch(
          `/api/pipelines/analytics/metrics?days=${days}`
        )
        performanceMetrics.value = response as PerformanceMetric[]
      } catch (err: any) {
        error.value = err.message || 'Failed to fetch performance metrics'
        console.error('Error fetching performance metrics:', err)
      } finally {
        isLoading.value = false
      }
    }

    const getPipelineExecution = async (executionId: string) => {
      try {
        const response = await $fetch(
          `/api/pipelines/executions/${executionId}`
        )
        return response
      } catch (err: any) {
        console.error('Error fetching pipeline execution:', err)
        throw err
      }
    }

    const getPipelineExecutions = async (
      pipelineId: string,
      limit: number = 50
    ) => {
      try {
        const response = await $fetch(
          `/api/pipelines/${pipelineId}/executions?limit=${limit}`
        )
        return response
      } catch (err: any) {
        console.error('Error fetching pipeline executions:', err)
        throw err
      }
    }

    const getPipelinePerformance = async (pipelineId: string) => {
      try {
        const response = await $fetch(
          `/api/pipelines/${pipelineId}/analytics/performance`
        )
        return response
      } catch (err: any) {
        console.error('Error fetching pipeline performance:', err)
        throw err
      }
    }

    const cancelExecution = async (executionId: string) => {
      try {
        const response = await $fetch(
          `/api/pipelines/executions/${executionId}/cancel`,
          {
            method: 'POST',
          }
        )

        // Update local state
        const execution = recentExecutions.value.find(
          exec => exec.id === executionId
        )
        if (execution) {
          execution.status = 'cancelled'
          execution.endTime = new Date().toISOString()
        }

        return response
      } catch (err: any) {
        console.error('Error cancelling execution:', err)
        throw err
      }
    }

    const retryExecution = async (executionId: string) => {
      try {
        const response = await $fetch(
          `/api/pipelines/executions/${executionId}/retry`,
          {
            method: 'POST',
          }
        )
        return response
      } catch (err: any) {
        console.error('Error retrying execution:', err)
        throw err
      }
    }

    const exportExecutionLogs = async (executionId: string) => {
      try {
        const response = await $fetch(
          `/api/pipelines/executions/${executionId}/logs/export`
        )
        return response
      } catch (err: any) {
        console.error('Error exporting execution logs:', err)
        throw err
      }
    }

    const refreshAnalytics = async () => {
      await Promise.all([
        fetchPipelineStats(),
        fetchRecentExecutions(),
        fetchPerformanceMetrics(),
      ])
    }

    const clearError = () => {
      error.value = null
    }

    return {
      // State
      pipelineStats,
      recentExecutions,
      performanceMetrics,
      isLoading,
      error,

      // Computed
      activeExecutionCount,
      failedExecutionCount,
      averageExecutionDuration,
      successRatePercentage,

      // Actions
      fetchPipelineStats,
      fetchRecentExecutions,
      fetchPerformanceMetrics,
      getPipelineExecution,
      getPipelineExecutions,
      getPipelinePerformance,
      cancelExecution,
      retryExecution,
      exportExecutionLogs,
      refreshAnalytics,
      clearError,
    }
  }
)
