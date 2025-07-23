import { defineEventHandler, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    // Get counts from database
    const [projectsCount, usersCount, activeProjectsCount] = await Promise.all([
      databaseService.prisma.project.count(),
      databaseService.prisma.user.count(),
      databaseService.prisma.project.count({
        where: {
          status: 'published'
        }
      })
    ])

    return {
      projects: projectsCount,
      users: usersCount,
      active: activeProjectsCount
    }
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error)
    
    // Return default values if database is not available
    return {
      projects: 0,
      users: 0,
      active: 0
    }
  }
}) 