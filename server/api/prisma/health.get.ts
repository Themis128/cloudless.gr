import { defineEventHandler, createError } from 'h3'
import { dbUtils } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const health = await dbUtils.healthCheck()
    
    return {
      success: true,
      data: health,
      message: 'Prisma database connection is healthy'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database health check failed',
      data: { error: error.message }
    })
  }
})