// server/api/activity.ts
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Mock activity data - in a real app, this would come from your database
    const activityData = [
      {
        id: '1',
        text: 'New bot "Customer Support Bot" created'
      },
      {
        id: '2',
        text: 'Pipeline "Data Processing Workflow" completed successfully'
      },
      {
        id: '3',
        text: 'AI model "Text Classifier v2" deployed to production'
      },
      {
        id: '4',
        text: 'System health check completed - all systems operational'
      }
    ]

    return {
      success: true,
      data: activityData,
      message: 'Activity data retrieved successfully'
    }
  } catch (error: any) {
    console.error('Error fetching activity data:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch activity data'
    })
  }
}) 