import { computed } from 'vue'

// Re-export types for backward compatibility
export interface DeploymentResponse {
  success: boolean
  data?: {
    deploymentId: string
    endpoint: string
    status: string
    message: string
  }
  message?: string
}

export interface DebugStateResponse {
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

// Composable that uses the Pinia store
export const useBotDeployer = () => {
  const botDeploymentStore = useBotDeploymentStore()

  // Return readonly state and computed properties for backward compatibility
  return {
    // State (readonly for backward compatibility)
    loading: computed(() => botDeploymentStore.loading),
    success: computed(() => botDeploymentStore.success),
    error: computed(() => botDeploymentStore.error),
    deploymentStatus: computed(() => botDeploymentStore.deploymentStatus),

    // Methods (delegate to store)
    deployBot: botDeploymentStore.deployBot,
    getDeploymentStatus: botDeploymentStore.getDeploymentStatus,
    reset: botDeploymentStore.reset,
    
    // Additional store methods
    getBotDeployment: botDeploymentStore.getBotDeployment,
    getDeploymentHistory: botDeploymentStore.getDeploymentHistory,
    clearDeploymentHistory: botDeploymentStore.clearDeploymentHistory,
    removeDeployment: botDeploymentStore.removeDeployment,
    clearError: botDeploymentStore.clearError,
    clearSuccess: botDeploymentStore.clearSuccess,
    
    // Computed properties from store
    isDeploying: computed(() => botDeploymentStore.isDeploying),
    isDeployed: computed(() => botDeploymentStore.isDeployed),
    hasFailed: computed(() => botDeploymentStore.hasFailed),
    canDeploy: computed(() => botDeploymentStore.canDeploy),
  }
}
