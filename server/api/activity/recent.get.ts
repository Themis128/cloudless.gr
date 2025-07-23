import { defineEventHandler, getQuery, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 10

    // Get recent projects
    const recentProjects = await databaseService.prisma.project.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        project_name: true,
        status: true,
        createdAt: true
      }
    })

    // Get recent users
    const recentUsers = await databaseService.prisma.user.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    })

    // Get recent bots
    const recentBots = await databaseService.prisma.bot.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true
      }
    })

    // Combine and format activities
    const activities = [
      ...recentProjects.map(project => ({
        id: `project-${project.id}`,
        text: `New project "${project.project_name}" was created`,
        timestamp: project.createdAt,
        type: 'project' as const
      })),
      ...recentUsers.map(user => ({
        id: `user-${user.id}`,
        text: `New user "${user.name}" joined`,
        timestamp: user.createdAt,
        type: 'user' as const
      })),
      ...recentBots.map(bot => ({
        id: `bot-${bot.id}`,
        text: `New bot "${bot.name}" was created`,
        timestamp: bot.createdAt,
        type: 'bot' as const
      }))
    ]

    // Sort by timestamp and take the most recent
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return sortedActivities
  } catch (error: any) {
    console.error('Error fetching recent activity:', error)
    
    // Return empty array if database is not available
    return []
  }
}) 