import { computed } from 'vue'
import { usePipelineStore } from '~/stores/pipelineStore'

export const usePipelineAnalytics = () => {
  const pipelineStore = usePipelineStore()

  const pipelineStats = computed(() => {
    const pipelines = pipelineStore.allPipelines
    return {
      total: pipelines.length,
      active: pipelines.filter(p => p.status === 'active').length,
      running: pipelines.filter(p => p.status === 'running').length,
      draft: pipelines.filter(p => p.status === 'draft').length,
      completed: pipelines.filter(p => p.status === 'completed').length,
      error: pipelines.filter(p => p.status === 'error').length
    }
  })

  const performanceTrends = computed(() => {
    // Mock performance data - in a real app, this would come from actual pipeline execution metrics
    return {
      averageExecutionTime: 2.5, // seconds
      averageResponseTime: 1500, // milliseconds
      successRate: 94.5, // percentage
      throughput: 12.3 // pipelines per hour
    }
  })

  const recentActivity = computed(() => {
    // Get recent pipelines sorted by updatedAt
    return pipelineStore.allPipelines
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map(pipeline => ({
        id: pipeline.id,
        name: pipeline.name,
        status: pipeline.status,
        updatedAt: pipeline.updatedAt,
        type: 'pipeline'
      }))
  })

  const pipelineTrends = computed(() => {
    // Mock trend data - in a real app, this would come from historical data
    const now = new Date()
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return {
      createdThisWeek: pipelineStore.allPipelines.filter(p => 
        new Date(p.createdAt) >= lastWeek
      ).length,
      activeThisWeek: pipelineStore.allPipelines.filter(p => 
        p.status === 'active' && new Date(p.updatedAt) >= lastWeek
      ).length,
      completedThisWeek: pipelineStore.allPipelines.filter(p => 
        p.status === 'completed' && new Date(p.updatedAt) >= lastWeek
      ).length
    }
  })

  const getPipelineEfficiency = (pipelineId: number) => {
    const pipeline = pipelineStore.pipelineById(pipelineId)
    if (!pipeline) return null

    // Mock efficiency calculation
    return {
      executionTime: 2.3,
      resourceUsage: 75.2,
      successRate: 96.8,
      throughput: 15.4
    }
  }

  const getPipelineMetrics = (pipelineId: number) => {
    const pipeline = pipelineStore.pipelineById(pipelineId)
    if (!pipeline) return null

    // Mock metrics
    return {
      totalRuns: 45,
      successfulRuns: 43,
      failedRuns: 2,
      averageExecutionTime: 2.1,
      lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      nextScheduledRun: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours from now
    }
  }

  return {
    pipelineStats,
    performanceTrends,
    recentActivity,
    pipelineTrends,
    getPipelineEfficiency,
    getPipelineMetrics
  }
} 