import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ActionCard {
  id: string
  title: string
  subtitle: string
  actions: ActionButton[]
  loading?: boolean
}

export interface ActionButton {
  id: string
  label: string
  icon: string
  color: string
  variant: 'elevated' | 'outlined' | 'text' | 'tonal'
  size: 'small' | 'default' | 'large' | 'x-large'
  to?: string
  href?: string
  disabled?: boolean
  onClick?: () => void
}

export interface MetricCard {
  id: string
  title: string
  value: string | number
  subtitle?: string
  icon: string
  iconColor: string
  valueColor: string
  loading?: boolean
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
    color: string
  }
}

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const loading = ref(false)
  const error = ref('')
  const stats = ref({
    projects: 0,
    users: 0,
    active: 0,
    bots: 0,
    models: 0,
    pipelines: 0,
  })

  // Missing properties that useDashboard.ts expects
  const recentActivity = ref([])
  const quickStats = ref({
    totalProjects: 0,
    activeUsers: 0,
    runningPipelines: 0,
    completedTasks: 0,
  })
  const systemStatus = ref({
    database: 'healthy',
    redis: 'healthy',
    api: 'healthy',
    overall: 'healthy',
  })

  // Action Cards - Consistent styling and structure
  const actionCards = ref<ActionCard[]>([
    {
      id: 'quick-actions',
      title: 'Quick Actions',
      subtitle: 'Create, test, or manage your AI components',
      loading: false,
      actions: [
        {
          id: 'create-bot',
          label: 'Create Bot',
          icon: 'mdi-plus',
          color: 'primary',
          variant: 'elevated',
          size: 'large',
          to: '/bots/create',
        },
        {
          id: 'test-bot',
          label: 'Test Bot',
          icon: 'mdi-play-circle',
          color: 'info',
          variant: 'outlined',
          size: 'large',
          to: '/bots/test',
        },
        {
          id: 'manage-bots',
          label: 'Manage Bots',
          icon: 'mdi-robot',
          color: 'secondary',
          variant: 'outlined',
          size: 'large',
          to: '/bots',
        },
      ],
    },
    {
      id: 'ai-models',
      title: 'AI Models',
      subtitle: 'Train, deploy, and manage your machine learning models',
      loading: false,
      actions: [
        {
          id: 'train-model',
          label: 'Train Model',
          icon: 'mdi-brain',
          color: 'success',
          variant: 'elevated',
          size: 'large',
          to: '/models/create',
        },
        {
          id: 'training-sessions',
          label: 'Training Sessions',
          icon: 'mdi-school',
          color: 'warning',
          variant: 'outlined',
          size: 'large',
          to: '/llm/training',
        },
        {
          id: 'view-models',
          label: 'View Models',
          icon: 'mdi-view-list',
          color: 'info',
          variant: 'outlined',
          size: 'large',
          to: '/models',
        },
      ],
    },
    {
      id: 'data-pipelines',
      title: 'Data Pipelines',
      subtitle: 'Build and orchestrate your data processing workflows',
      loading: false,
      actions: [
        {
          id: 'create-pipeline',
          label: 'Create Pipeline',
          icon: 'mdi-plus',
          color: 'purple',
          variant: 'elevated',
          size: 'large',
          to: '/pipelines/create',
        },
        {
          id: 'manage-pipelines',
          label: 'Manage Pipelines',
          icon: 'mdi-timeline',
          color: 'orange',
          variant: 'outlined',
          size: 'large',
          to: '/pipelines',
        },
        {
          id: 'datasets',
          label: 'Datasets',
          icon: 'mdi-database',
          color: 'teal',
          variant: 'outlined',
          size: 'large',
          to: '/llm/datasets',
        },
      ],
    },
    {
      id: 'analytics-insights',
      title: 'Analytics & Insights',
      subtitle: 'Monitor performance and gain insights from your data',
      loading: false,
      actions: [
        {
          id: 'view-analytics',
          label: 'View Analytics',
          icon: 'mdi-chart-line',
          color: 'indigo',
          variant: 'elevated',
          size: 'large',
          to: '/llm/analytics',
        },
        {
          id: 'cost-analysis',
          label: 'Cost Analysis',
          icon: 'mdi-currency-usd',
          color: 'amber',
          variant: 'outlined',
          size: 'large',
          to: '/llm/analytics/costs',
        },
        {
          id: 'api-docs',
          label: 'API Docs',
          icon: 'mdi-api',
          color: 'deep-purple',
          variant: 'outlined',
          size: 'large',
          to: '/llm/api',
        },
      ],
    },
    {
      id: 'deployment-ops',
      title: 'Deployment & Ops',
      subtitle: 'Deploy and manage your applications and infrastructure',
      loading: false,
      actions: [
        {
          id: 'deploy-app',
          label: 'Deploy App',
          icon: 'mdi-rocket-launch',
          color: 'green',
          variant: 'elevated',
          size: 'large',
          to: '/deploy',
        },
        {
          id: 'debug-tools',
          label: 'Debug Tools',
          icon: 'mdi-bug',
          color: 'red',
          variant: 'outlined',
          size: 'large',
          to: '/debug',
        },
        {
          id: 'system-health',
          label: 'System Health',
          icon: 'mdi-heart-pulse',
          color: 'pink',
          variant: 'outlined',
          size: 'large',
          to: '/admin/health',
        },
      ],
    },
  ])

  // Metric Cards - Consistent styling with trends
  const metricCards = computed<MetricCard[]>(() => [
    {
      id: 'total-bots',
      title: 'Total Bots',
      value: stats.value.bots,
      subtitle: 'Active bots in system',
      icon: 'mdi-robot',
      iconColor: 'primary',
      valueColor: 'primary',
      loading: loading.value,
      trend: {
        value: 12,
        direction: 'up',
        color: 'success',
      },
    },
    {
      id: 'active-pipelines',
      title: 'Active Pipelines',
      value: stats.value.pipelines,
      subtitle: 'Running workflows',
      icon: 'mdi-timeline',
      iconColor: 'success',
      valueColor: 'success',
      loading: loading.value,
      trend: {
        value: 8,
        direction: 'up',
        color: 'success',
      },
    },
    {
      id: 'ai-models',
      title: 'AI Models',
      value: stats.value.models,
      subtitle: 'Trained models',
      icon: 'mdi-brain',
      iconColor: 'info',
      valueColor: 'info',
      loading: loading.value,
      trend: {
        value: 3,
        direction: 'up',
        color: 'success',
      },
    },
    {
      id: 'system-health',
      title: 'System Health',
      value: 'Good',
      subtitle: 'All systems operational',
      icon: 'mdi-check-circle',
      iconColor: 'success',
      valueColor: 'success',
      loading: loading.value,
      trend: {
        value: 99.9,
        direction: 'neutral',
        color: 'success',
      },
    },
  ])

  // Actions
  const fetchDashboardData = async () => {
    try {
      loading.value = true
      error.value = ''

      // Fetch stats from API
      const statsResponse = await $fetch<{
        projects: number
        users: number
        active: number
      }>('/api/stats/dashboard')

      // Update stats
      stats.value = {
        projects: statsResponse.projects || 0,
        users: statsResponse.users || 0,
        active: statsResponse.active || 0,
        bots: statsResponse.projects || 0, // Map projects to bots for now
        models: statsResponse.users || 0, // Map users to models for now
        pipelines: statsResponse.active || 0,
      }
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err)
      error.value = err.message || 'Failed to load dashboard data'

      // Set default values on error
      stats.value = {
        projects: 0,
        users: 0,
        active: 0,
        bots: 0,
        models: 0,
        pipelines: 0,
      }
    } finally {
      loading.value = false
    }
  }

  const updateActionCardLoading = (cardId: string, isLoading: boolean) => {
    const card = actionCards.value.find(c => c.id === cardId)
    if (card) {
      card.loading = isLoading
    }
  }

  const addActionCard = (card: ActionCard) => {
    // Ensure consistent structure
    const normalizedCard: ActionCard = {
      id: card.id,
      title: card.title,
      subtitle: card.subtitle,
      loading: card.loading || false,
      actions: card.actions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        color: action.color,
        variant: action.variant,
        size: action.size || 'large',
        to: action.to,
        href: action.href,
        disabled: action.disabled || false,
        onClick: action.onClick,
      })),
    }
    actionCards.value.push(normalizedCard)
  }

  const removeActionCard = (cardId: string) => {
    const index = actionCards.value.findIndex(c => c.id === cardId)
    if (index > -1) {
      actionCards.value.splice(index, 1)
    }
  }

  const updateActionCard = (cardId: string, updates: Partial<ActionCard>) => {
    const card = actionCards.value.find(c => c.id === cardId)
    if (card) {
      Object.assign(card, updates)
    }
  }

  const clearError = () => {
    error.value = ''
  }

  // Add missing method that useDashboard.ts expects
  const refreshDashboardData = async () => {
    return await fetchDashboardData()
  }

  // Helper function to create consistent action cards
  const createActionCard = (
    id: string,
    title: string,
    subtitle: string,
    actions: ActionButton[]
  ): ActionCard => {
    return {
      id,
      title,
      subtitle,
      loading: false,
      actions: actions.map(action => ({
        ...action,
        size: action.size || 'large',
        disabled: action.disabled || false,
      })),
    }
  }

  return {
    // State
    loading,
    error,
    stats,
    actionCards,
    metricCards,
    recentActivity,
    quickStats,
    systemStatus,

    // Actions
    fetchDashboardData,
    refreshDashboardData,
    updateActionCardLoading,
    addActionCard,
    removeActionCard,
    updateActionCard,
    clearError,
    createActionCard,
  }
})
