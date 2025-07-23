import { defineEventHandler } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    // Get basic stats from the database
    const [projects, users] = await Promise.all([
      databaseService.prisma.project.count(),
      databaseService.prisma.user.count()
    ])

    return {
      projects,
      users,
      active: projects // For now, assume all projects are active
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    // Return default stats if database fails
    return {
      projects: 0,
      users: 0,
      active: 0
    }
  }
}) 