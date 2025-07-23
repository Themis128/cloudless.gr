import { defineEventHandler } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    // Get recent projects as activity
    const recentProjects = await databaseService.prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        project_name: true,
        createdAt: true
      }
    })

    // Convert projects to activity format
    const activities = recentProjects.map(project => ({
      id: project.id.toString(),
      text: `Project "${project.project_name}" was created`
    }))

    return activities
  } catch (error) {
    console.error('Error fetching activity:', error)
    // Return empty array if database fails
    return []
  }
}) 