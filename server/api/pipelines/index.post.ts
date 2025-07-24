export default defineEventHandler(async (event) => {
  try {
    const { $prisma } = event.context
    const body = await readBody(event)
    
    // Get user from session/token
    const user = await getUserFromRequest(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
    
    // Validate required fields
    const { name, description, config: pipelineConfig, modelId } = body
    
    if (!name || !pipelineConfig) {
      throw createError({
        statusCode: 400,
        message: 'Name and config are required'
      })
    }
    
    // Validate pipeline configuration
    const validation = validatePipelineConfig(pipelineConfig)
    if (!validation.isValid) {
      throw createError({
        statusCode: 400,
        message: validation.error
      })
    }
    
    // Check pipeline limits
    const runtimeConfig = useRuntimeConfig()
    const existingPipelines = await $prisma.pipeline.count({
      where: { userId: user.id }
    })
    
    if (existingPipelines >= runtimeConfig.public.maxPipelinesPerUser) {
      throw createError({
        statusCode: 429,
        message: `You have reached the maximum limit of ${runtimeConfig.public.maxPipelinesPerUser} pipelines`
      })
    }
    
    // Create the pipeline
    const pipeline = await $prisma.pipeline.create({
      data: {
        name,
        description: description || '',
        config: typeof pipelineConfig === 'string' ? pipelineConfig : JSON.stringify(pipelineConfig),
        status: 'draft',
        userId: user.id,
        modelId: modelId ? parseInt(modelId) : null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
    
    // Clear cache
    const cacheKey = `pipelines:${user.id}`
    await $storage.removeItem(cacheKey)
    
    return {
      success: true,
      data: pipeline,
      message: 'Pipeline created successfully'
    }
  } catch (error) {
    console.error('Error creating pipeline:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create pipeline'
    })
  }
})

function validatePipelineConfig(pipelineConfig: any): { isValid: boolean; error?: string } {
  try {
    const parsed = typeof pipelineConfig === 'string' ? JSON.parse(pipelineConfig) : pipelineConfig
    
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      return { isValid: false, error: 'Pipeline must have a steps array' }
    }
    
    if (parsed.steps.length === 0) {
      return { isValid: false, error: 'Pipeline must have at least one step' }
    }
    
    // Validate each step
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i]
      if (!step.name || !step.type) {
        return { 
          isValid: false, 
          error: `Step ${i + 1} must have a name and type` 
        }
      }
    }
    
    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON configuration' }
  }
}

async function getUserFromRequest(event: any) {
  // In a real app, this would extract user from JWT token or session
  // For now, return a mock user
  return { id: 1, name: 'Test User', email: 'test@example.com' }
} 