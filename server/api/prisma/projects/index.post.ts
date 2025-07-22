import { defineEventHandler, readBody, createError } from 'h3'
import { projectService } from '~/lib/database'
import { ProjectType, ProjectStatus } from '~/generated/prisma'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Validate required fields
    const { name, description, type, framework, owner_id } = body

    if (!name || !owner_id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: name, owner_id'
      })
    }

    // Validate project type if provided
    if (type && !Object.values(ProjectType).includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid project type'
      })
    }

    // Create project data
    const projectData = {
      name,
      description,
      type: type as ProjectType,
      framework,
      status: ProjectStatus.draft,
      owner: owner_id ? {
        connect: { id: owner_id }
      } : undefined,
      config: body.config || {}
    }

    const project = await projectService.createProject(projectData)

    return {
      success: true,
      data: project,
      message: 'Project created successfully'
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    // Handle Prisma errors
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A project with this name already exists'
      })
    }

    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Owner not found'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create project',
      data: { error: error.message }
    })
  }
})