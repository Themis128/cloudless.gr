import { defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  try {
    const prisma = getPrismaClient()

    // Get comprehensive dashboard stats
    const [projects, users, bots, models, pipelines] = await Promise.all([
      prisma.project.count(),
      prisma.user.count(),
      prisma.bot?.count() || Promise.resolve(0),
      prisma.model?.count() || Promise.resolve(0),
      prisma.pipeline?.count() || Promise.resolve(0),
    ])

    return {
      projects,
      users,
      active: projects, // For now, assume all projects are active
      bots,
      models,
      pipelines,
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    // Return default stats if database fails
    return {
      projects: 0,
      users: 0,
      active: 0,
      bots: 0,
      models: 0,
      pipelines: 0,
    }
  }
})
