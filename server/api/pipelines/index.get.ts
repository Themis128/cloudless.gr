export default defineEventHandler(async (event) => {
  try {
    const { $prisma } = event.context
    
    // Get user from session/token
    const user = await getUserFromRequest(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
    
    // Fetch pipelines for the user
    const pipelines = await $prisma.pipeline.findMany({
      where: {
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
          take: 5
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    
    // Cache the result
    const cacheKey = `pipelines:${user.id}`
    await $storage.setItem(cacheKey, pipelines, { ttl: 300 }) // 5 minutes
    
    return {
      success: true,
      data: pipelines,
      count: pipelines.length
    }
  } catch (error) {
    console.error('Error fetching pipelines:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch pipelines'
    })
  }
})

async function getUserFromRequest(event: any) {
  // In a real app, this would extract user from JWT token or session
  // For now, return a mock user
  return { id: 1, name: 'Test User', email: 'test@example.com' }
} 