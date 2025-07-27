import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGlobalStateStore = defineStore('globalState', () => {
  const isLoading = ref(false)
  const globalError = ref<string | null>(null)
  const lastAction = ref<string | null>(null)
  const actionTimestamp = ref<number | null>(null)

  // Cross-store computed properties
  const userStats = computed(() => {
    const authStore = useAuthStore()
    const botStore = useBotStore()
    const projectStore = useProjectsStore()
    const pipelineStore = usePipelineStore()

    const user = authStore.user
    if (!user) return null

    const userBots = botStore.allBots.filter(
      bot => (bot as any).userId === user.id
    )
    const userProjects = projectStore.allProjects.filter(
      project => project.userId === user.id
    )
    const userPipelines = pipelineStore.allPipelines.filter(
      pipeline => pipeline.userId === user.id
    )

    return {
      totalBots: userBots.length,
      activeBots: userBots.filter(bot => bot.status === 'active').length,
      totalProjects: userProjects.length,
      totalPipelines: userPipelines.length,
      userRole: user.role,
      lastLogin: (user as any).lastLogin,
    }
  })

  const systemHealth = computed(() => {
    const botStore = useBotStore()
    const pipelineStore = usePipelineStore()
    const modelStore = useModelStore()

    const totalBots = botStore.allBots.length
    const activeBots = botStore.allBots.filter(
      bot => bot.status === 'active'
    ).length
    const totalPipelines = pipelineStore.allPipelines.length
    const runningPipelines = pipelineStore.allPipelines.filter(
      p => p.status === 'running'
    ).length
    const totalModels = modelStore.allModels.length

    return {
      bots: {
        total: totalBots,
        active: activeBots,
        health: totalBots > 0 ? (activeBots / totalBots) * 100 : 0,
      },
      pipelines: {
        total: totalPipelines,
        running: runningPipelines,
        health:
          totalPipelines > 0 ? (runningPipelines / totalPipelines) * 100 : 0,
      },
      models: {
        total: totalModels,
        available: totalModels,
      },
      overall: {
        health:
          totalBots + totalPipelines > 0
            ? ((activeBots + runningPipelines) / (totalBots + totalPipelines)) *
              100
            : 0,
      },
    }
  })

  const recentActivity = computed(() => {
    const botStore = useBotStore()
    const pipelineStore = usePipelineStore()
    const projectStore = useProjectsStore()

    const allActivities = [
      ...botStore.allBots.map(bot => ({
        type: 'bot',
        id: bot.id,
        name: bot.name,
        action: 'updated',
        timestamp: bot.updatedAt,
        status: bot.status,
      })),
      ...pipelineStore.allPipelines.map(pipeline => ({
        type: 'pipeline',
        id: pipeline.id,
        name: pipeline.name,
        action: 'updated',
        timestamp: pipeline.updatedAt,
        status: pipeline.status,
      })),
      ...projectStore.allProjects.map(project => ({
        type: 'project',
        id: project.id,
        name: project.project_name,
        action: 'updated',
        timestamp: project.updatedAt,
        status: project.status,
      })),
    ]

    return allActivities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 20)
  })

  const userPermissions = computed(() => {
    const authStore = useAuthStore()
    const user = authStore.user

    if (!user) return []

    const permissions = []

    // Role-based permissions
    if (user.role === 'admin') {
      permissions.push(
        'manage_users',
        'manage_bots',
        'manage_pipelines',
        'manage_models',
        'view_analytics',
        'system_settings'
      )
    } else if (user.role === 'developer') {
      permissions.push(
        'create_bots',
        'edit_own_bots',
        'create_pipelines',
        'edit_own_pipelines',
        'view_own_analytics'
      )
    } else {
      permissions.push('view_own_bots', 'use_bots', 'view_own_pipelines')
    }

    return permissions
  })

  // Global actions
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setGlobalError = (error: string | null) => {
    globalError.value = error
  }

  const trackAction = (action: string) => {
    lastAction.value = action
    actionTimestamp.value = Date.now()
  }

  const clearGlobalError = () => {
    globalError.value = null
  }

  // Cross-store operations
  const refreshAllData = async () => {
    setLoading(true)
    setGlobalError(null)
    trackAction('refresh_all_data')

    try {
      const botStore = useBotStore()
      const pipelineStore = usePipelineStore()
      const projectStore = useProjectsStore()
      const modelStore = useModelStore()

      await Promise.all([
        botStore.fetchAll(),
        pipelineStore.fetchAll(),
        projectStore.fetchProjects(),
        modelStore.fetchAll(),
      ])

      trackAction('refresh_all_data_success')
    } catch (error: any) {
      setGlobalError(error.message || 'Failed to refresh data')
      trackAction('refresh_all_data_error')
    } finally {
      setLoading(false)
    }
  }

  const getUserDashboardData = async (userId: number) => {
    setLoading(true)
    setGlobalError(null)
    trackAction('get_user_dashboard_data')

    try {
      const botStore = useBotStore()
      const pipelineStore = usePipelineStore()
      const projectStore = useProjectsStore()

      const [bots, pipelines, projects] = await Promise.all([
        botStore.fetchAll(),
        pipelineStore.fetchAll(),
        projectStore.fetchProjects(),
      ])

      const userData = {
        bots: bots.filter(bot => bot.userId === userId),
        pipelines: pipelines.filter(pipeline => pipeline.userId === userId),
        projects: projects.filter(project => project.userId === userId),
      }

      trackAction('get_user_dashboard_data_success')
      return userData
    } catch (error: any) {
      setGlobalError(error.message || 'Failed to get user dashboard data')
      trackAction('get_user_dashboard_data_error')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const cleanupUserData = async (userId: number) => {
    setLoading(true)
    setGlobalError(null)
    trackAction('cleanup_user_data')

    try {
      const botStore = useBotStore()
      const pipelineStore = usePipelineStore()
      const projectStore = useProjectsStore()

      // Get user's data
      const userBots = botStore.allBots.filter(bot => (bot as any).userId === userId)
      const userPipelines = pipelineStore.allPipelines.filter(
        pipeline => pipeline.userId === userId
      )
      const userProjects = projectStore.allProjects.filter(
        project => project.userId === userId
      )

      // Delete user's data
      await Promise.all([
        ...userBots.map(bot => botStore.deleteBot(bot.id)),
        ...userPipelines.map(pipeline =>
          pipelineStore.deletePipeline(pipeline.id)
        ),
        ...userProjects.map(project => projectStore.deleteProject(project.id)),
      ])

      trackAction('cleanup_user_data_success')
    } catch (error: any) {
      setGlobalError(error.message || 'Failed to cleanup user data')
      trackAction('cleanup_user_data_error')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    // State
    isLoading,
    globalError,
    lastAction,
    actionTimestamp,

    // Computed
    userStats,
    systemHealth,
    recentActivity,
    userPermissions,

    // Actions
    setLoading,
    setGlobalError,
    clearGlobalError,
    trackAction,
    refreshAllData,
    getUserDashboardData,
    cleanupUserData,
  }
})
