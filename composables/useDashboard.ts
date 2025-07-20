import { computed, ref } from 'vue'
import { useBotStore } from '~/stores/botStore'
import { useModelStore } from '~/stores/modelStore'
import { usePipelineStore } from '~/stores/pipelineStore'
import { useProjectStore } from '~/stores/projectStore'

export const useDashboard = () => {
  const botStore = useBotStore()
  const modelStore = useModelStore()
  const pipelineStore = usePipelineStore()
  const projectStore = useProjectStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties for dashboard data
  const stats = computed(() => ({
    bots: botStore.bots.length,
    models: modelStore.models.length,
    pipelines: pipelineStore.pipelines.length,
    projects: projectStore.projects.length,
  }))

  const recentProjects = computed(() => {
    return projectStore.projects.slice(0, 5)
  })

  const recentActivity = computed(() => {
    const activities: any[] = []
    
    // Add recent bots
    botStore.bots.slice(0, 3).forEach(bot => {
      activities.push({
        id: `bot-${bot.id}`,
        title: `Bot created: ${bot.name}`,
        description: 'New AI assistant created',
        icon: 'mdi-robot',
        color: 'primary',
        created_at: bot.created_at,
        type: 'bot'
      })
    })
    
    // Add recent models
    modelStore.models.slice(0, 3).forEach(model => {
      activities.push({
        id: `model-${model.id}`,
        title: `Model created: ${model.name}`,
        description: 'New AI model added',
        icon: 'mdi-brain',
        color: 'success',
        created_at: model.created_at,
        type: 'model'
      })
    })
    
    // Add recent pipelines
    pipelineStore.pipelines.slice(0, 3).forEach(pipeline => {
      activities.push({
        id: `pipeline-${pipeline.id}`,
        title: `Pipeline created: ${pipeline.name}`,
        description: 'New data pipeline created',
        icon: 'mdi-timeline',
        color: 'warning',
        created_at: pipeline.created_at,
        type: 'pipeline'
      })
    })
    
    // Add recent projects
    projectStore.projects.slice(0, 3).forEach(project => {
      activities.push({
        id: `project-${project.id}`,
        title: `Project created: ${project.name}`,
        description: 'New project started',
        icon: 'mdi-folder',
        color: 'info',
        created_at: project.created_at,
        type: 'project'
      })
    })
    
    // Sort by creation date and return top 10
    return activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
  })

  const fetchAllData = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      await Promise.all([
        botStore.fetchAll(),
        modelStore.fetchAll(),
        pipelineStore.fetchAll(),
        projectStore.fetchAll()
      ])
    } catch (err: any) {
      error.value = err.message || 'Failed to load dashboard data'
    } finally {
      isLoading.value = false
    }
  }

  const refreshData = async () => {
    await fetchAllData()
  }

  return {
    isLoading,
    error,
    stats,
    recentProjects,
    recentActivity,
    fetchAllData,
    refreshData,
    // Expose stores for direct access if needed
    botStore,
    modelStore,
    pipelineStore,
    projectStore
  }
} 