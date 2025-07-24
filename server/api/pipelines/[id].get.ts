export default defineEventHandler(async (event) => {
  try {
    const { $prisma } = event.context
    const pipelineId = getRouterParam(event, 'id')
    
    if (!pipelineId) {
      throw createError({
        statusCode: 400,
        message: 'Pipeline ID is required'
      })
    }
    
    // Get user from session/token
    const user = await getUserFromRequest(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
    
    // Fetch the specific pipeline
    const pipeline = await $prisma.pipeline.findFirst({
      where: {
        id: parseInt(pipelineId),
        userId: user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        runs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })
    
    if (!pipeline) {
      throw createError({
        statusCode: 404,
        message: 'Pipeline not found'
      })
    }
    
    return {
      success: true,
      data: pipeline
    }
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch pipeline'
    })
  }
})

async function getUserFromRequest(event: any) {
  // In a real app, this would extract user from JWT token or session
  // For now, return a mock user
  return { id: 1, name: 'Test User', email: 'test@example.com' }
} 