import { createError, defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  const prisma = await getPrismaClient()
  if (!prisma) {
    throw createError({
      statusCode: 500,
      message: 'Database service unavailable',
    })
  }

  try {
    // Get analytics data using the correct Prisma models
    const models = await prisma.model.findMany()
    const modelsByStatus = models.reduce((acc: any, model: any) => {
      acc[model.status] = (acc[model.status] || 0) + 1
      return acc
    }, {})

    const modelsByType = models.reduce((acc: any, model: any) => {
      acc[model.type] = (acc[model.type] || 0) + 1
      return acc
    }, {})

    // Get training sessions using the correct model
    const trainingSessions = await prisma.modelTraining.findMany()
    const runningTraining = trainingSessions.filter(
      (t: any) => t.status === 'running'
    ).length
    const completedTraining = trainingSessions.filter(
      (t: any) => t.status === 'completed'
    ).length
    const failedTraining = trainingSessions.filter(
      (t: any) => t.status === 'failed'
    ).length

    // Calculate average training time
    const completedSessions = trainingSessions.filter(
      (t: any) => t.status === 'completed' && t.started_at && t.completed_at
    )
    const avgTrainingTime =
      completedSessions.length > 0
        ? completedSessions.reduce((acc: any, session: any) => {
            const duration =
              new Date(session.completed_at).getTime() -
              new Date(session.started_at).getTime()
            return acc + duration
          }, 0) / completedSessions.length
        : 0

    // Get deployments using the correct model
    const deployments = await prisma.botDeployment.findMany()
    const activeDeployments = deployments.filter(
      (d: any) => d.status === 'active'
    ).length
    const inactiveDeployments = deployments.filter(
      (d: any) => d.status === 'inactive'
    ).length

    // Calculate total requests and average response time
    const totalRequests = deployments.reduce((acc: any, deployment: any) => {
      return acc + (deployment.metrics?.total_requests || 0)
    }, 0)

    const avgResponseTime =
      deployments.length > 0
        ? deployments.reduce((acc: any, deployment: any) => {
            return acc + (deployment.metrics?.avg_response_time || 0)
          }, 0) / deployments.length
        : 0

    return {
      success: true,
      data: {
        models: {
          total: models.length,
          byStatus: modelsByStatus,
          byType: modelsByType,
        },
        training: {
          total: trainingSessions.length,
          running: runningTraining,
          completed: completedTraining,
          failed: failedTraining,
          avgTrainingTime: Math.round(avgTrainingTime / 1000 / 60), // Convert to minutes
        },
        deployments: {
          total: deployments.length,
          active: activeDeployments,
          inactive: inactiveDeployments,
          totalRequests,
          avgResponseTime: Math.round(avgResponseTime),
        },
      },
      message: 'Analytics data retrieved successfully',
    }
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch analytics data',
    })
  }
})
