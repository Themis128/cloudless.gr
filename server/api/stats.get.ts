import { defineEventHandler } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async event => {
  try {
    const prisma = getPrismaClient()

    // Get basic stats from the database
    const [projects, users] = await Promise.all([
      prisma.project.count(),
      prisma.user.count(),
    ])

    return {
      projects,
      users,
      active: projects, // For now, assume all projects are active
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    // Return default stats if database fails
    return {
      projects: 0,
      users: 0,
      active: 0,
    }
  }
})
