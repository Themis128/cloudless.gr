import { defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const prisma = await getPrismaClient()
  if (!prisma) {
    throw createError({
      statusCode: 500,
      message: 'Database service unavailable'
    })
  }

  try {
    // Get models statistics
    const models = await prisma.llmModel.findMany()
    const modelsByStatus = models.reduce((acc, model) => {
      acc[model.status] = (acc[model.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const modelsByType = models.reduce((acc, model) => {
      acc[model.type] = (acc[model.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get training sessions statistics
    const trainingSessions = await prisma.trainingSession.findMany()
    const runningTraining = trainingSessions.filter(t => t.status === 'running').length
    const completedTraining = trainingSessions.filter(t => t.status === 'completed').length
    const failedTraining = trainingSessions.filter(t => t.status === 'failed').length
    
    // Calculate average training duration
    const completedSessions = trainingSessions.filter(t => t.status === 'completed' && t.startedAt && t.completedAt)
    const averageDuration = completedSessions.length > 0 
      ? completedSessions.reduce((acc, session) => {
          const duration = new Date(session.completedAt!).getTime() - new Date(session.startedAt!).getTime()
          return acc + duration
        }, 0) / completedSessions.length
      : 0

    // Get deployments statistics
    const deployments = await prisma.deployment.findMany()
    const activeDeployments = deployments.filter(d => d.status === 'active').length
    const inactiveDeployments = deployments.filter(d => d.status === 'inactive').length
    
    // Calculate deployment metrics
    const totalRequests = deployments.reduce((acc, deployment) => {
      return acc + (deployment.metrics?.requestsPerSecond || 0)
    }, 0)
    
    const averageResponseTime = deployments.length > 0 
      ? deployments.reduce((acc, deployment) => {
          return acc + (deployment.metrics?.averageResponseTime || 0)
        }, 0) / deployments.length
      : 0

    // Mock usage statistics (in a real app, this would come from actual usage tracking)
    const usage = {
      totalRequests: totalRequests * 86400, // Convert RPS to daily requests
      requestsToday: Math.floor(totalRequests * 86400 * 0.1), // 10% of daily total
      averageRequestsPerDay: Math.floor(totalRequests * 86400 * 0.8), // 80% of daily total
      costPerDay: activeDeployments * 5.0 // $5 per active deployment per day
    }

    const analytics = {
      models: {
        total: models.length,
        byStatus: modelsByStatus,
        byType: modelsByType
      },
      training: {
        total: trainingSessions.length,
        running: runningTraining,
        completed: completedTraining,
        failed: failedTraining,
        averageDuration: Math.round(averageDuration / (1000 * 60 * 60)) // Convert to hours
      },
      deployments: {
        total: deployments.length,
        active: activeDeployments,
        inactive: inactiveDeployments,
        totalRequests: Math.round(totalRequests),
        averageResponseTime: Math.round(averageResponseTime)
      },
      usage
    }

    return {
      success: true,
      data: analytics,
      message: 'Analytics retrieved successfully'
    }
  } catch (error: any) {
    console.error('LLM Analytics API error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error'
    })
  }
}) 