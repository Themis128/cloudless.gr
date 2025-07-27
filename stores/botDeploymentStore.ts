import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface DeploymentResponse {
  success: boolean
  data?: {
    deploymentId: string
    endpoint: string
    status: string
    message: string
  }
  message?: string
}

interface DebugStateResponse {
  success: boolean
  data: {
    id: string
    type: string
    status: string
    name?: string
    endpoint_url?: string
    config?: any
  }
}

interface DeploymentConfig {
  deploymentName: string
  environment: string
  instanceType: string
  replicas?: number
}

export const useBotDeploymentStore = defineStore('botDeployment', () => {
  // State
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const deploymentStatus = ref<string>('idle')
  const deployments = ref<Record<string, any>>({})
  const deploymentHistory = ref<Array<{
    id: string
    botId: string
    status: string
    timestamp: string
    config: DeploymentConfig
  }>>([])

  // Computed properties
  const isDeploying = computed(() => deploymentStatus.value === 'deploying')
  const isDeployed = computed(() => deploymentStatus.value === 'deployed')
  const hasFailed = computed(() => deploymentStatus.value === 'failed')
  const canDeploy = computed(() => !loading.value && deploymentStatus.value !== 'deploying')

  // Actions
  const deployBot = async (botId: string, deploymentConfig: DeploymentConfig) => {
    loading.value = true
    success.value = false
    error.value = null
    deploymentStatus.value = 'deploying'

    try {
      const response = await $fetch<DeploymentResponse>('/api/bots/deploy', {
        method: 'POST',
        body: {
          botId,
          ...deploymentConfig,
        },
      })

      if (response.success && response.data) {
        success.value = true
        deploymentStatus.value = 'deployed'
        
        // Store deployment info
        deployments.value[botId] = response.data
        
        // Add to history
        deploymentHistory.value.push({
          id: response.data.deploymentId,
          botId,
          status: response.data.status,
          timestamp: new Date().toISOString(),
          config: deploymentConfig
        })
        
        return response.data
      } else {
        throw new Error(response.message || 'Deployment failed')
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to deploy bot'
      deploymentStatus.value = 'failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  const getDeploymentStatus = async (deploymentId: string) => {
    try {
      const response = await $fetch<DebugStateResponse>(`/api/debug/state/deployment/${deploymentId}`)
      
      // Update deployment status in store
      if (response.success) {
        const botId = Object.keys(deployments.value).find(key => 
          deployments.value[key].deploymentId === deploymentId
        )
        if (botId) {
          deployments.value[botId] = {
            ...deployments.value[botId],
            status: response.data.status
          }
        }
      }
      
      return response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to get deployment status'
      throw err
    }
  }

  const getBotDeployment = (botId: string) => {
    return deployments.value[botId] || null
  }

  const getDeploymentHistory = (botId?: string) => {
    if (botId) {
      return deploymentHistory.value.filter(deployment => deployment.botId === botId)
    }
    return deploymentHistory.value
  }

  const clearDeploymentHistory = () => {
    deploymentHistory.value = []
  }

  const removeDeployment = (botId: string) => {
    if (deployments.value[botId]) {
      delete deployments.value[botId]
    }
  }

  const reset = () => {
    loading.value = false
    success.value = false
    error.value = null
    deploymentStatus.value = 'idle'
  }

  const clearError = () => {
    error.value = null
  }

  const clearSuccess = () => {
    success.value = false
  }

  return {
    // State
    loading,
    success,
    error,
    deploymentStatus,
    deployments,
    deploymentHistory,
    
    // Computed
    isDeploying,
    isDeployed,
    hasFailed,
    canDeploy,
    
    // Actions
    deployBot,
    getDeploymentStatus,
    getBotDeployment,
    getDeploymentHistory,
    clearDeploymentHistory,
    removeDeployment,
    reset,
    clearError,
    clearSuccess
  }
}) 