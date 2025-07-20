import { ref } from 'vue'

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

export const useBotDeployer = () => {
  const loading = ref(false)
  const success = ref(false)
  const error = ref<string | null>(null)
  const deploymentStatus = ref<string>('idle')

  const deployBot = async (botId: string, deploymentConfig: {
    deploymentName: string
    environment: string
    instanceType: string
    replicas?: number
  }) => {
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

      if (response.success) {
        success.value = true
        deploymentStatus.value = 'deployed'
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
      return response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to get deployment status'
      throw err
    }
  }

  const reset = () => {
    loading.value = false
    success.value = false
    error.value = null
    deploymentStatus.value = 'idle'
  }

  return {
    loading,
    success,
    error,
    deploymentStatus,
    deployBot,
    getDeploymentStatus,
    reset,
  }
}
