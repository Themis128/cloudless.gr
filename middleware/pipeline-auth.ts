export default defineNuxtRouteMiddleware((to) => {
  const { $auth } = useNuxtApp()
  const config = useRuntimeConfig()
  
  // Check if user is authenticated for pipeline routes
  if (to.path.startsWith('/pipelines/') && !$auth?.isAuthenticated) {
    return navigateTo('/auth/login')
  }
  
  // Check pipeline-specific permissions
  if (to.params.id) {
    const pipelineId = to.params.id as string
    
    // Check if user has access to this specific pipeline
    const hasAccess = checkPipelineAccess(pipelineId)
    if (!hasAccess) {
      throw createError({ 
        statusCode: 403, 
        message: 'You do not have permission to access this pipeline' 
      })
    }
  }
  
  // Check pipeline limits for creation
  if (to.path === '/pipelines/create') {
    const pipelineStore = usePipelineStore()
    const maxPipelines = config.public.maxPipelinesPerUser
    
    if (pipelineStore.allPipelines.length >= maxPipelines) {
      throw createError({ 
        statusCode: 429, 
        message: `You have reached the maximum limit of ${maxPipelines} pipelines` 
      })
    }
  }
})

// Helper function to check pipeline access
function checkPipelineAccess(pipelineId: string): boolean {
  // In a real app, this would check against user permissions
  // For now, we'll allow access to all pipelines
  return true
} 