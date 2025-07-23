import { defineEventHandler, readBody, createError } from 'h3'
import { databaseService } from '~/lib/database'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    // Validate required fields
    if (!body.project_name || !body.description) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Project name and description are required'
      })
    }

    // Create project in database
    const project = await databaseService.prisma.project.create({
      data: {
        project_name: body.project_name,
        description: body.description,
        slug: body.project_name.toLowerCase().replace(/\s+/g, '-'),
        overview: body.description,
        status: body.status || 'draft',
        category: body.category || 'other',
        featured: body.featured || false,
        userId: 1 // Default to first user for now
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return {
      success: true,
      data: project,
      message: 'Project created successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create project',
      data: { error: error.message }
    })
  }
})