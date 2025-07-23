import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pipeline ID is required'
      })
    }

    const pipelineId = parseInt(id)
    if (isNaN(pipelineId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pipeline ID format'
      })
    }

    // Validate the update data
    const { name, description, config, status } = body
    
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be a non-empty string'
      })
    }
    
    if (description !== undefined && typeof description !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Description must be a string'
      })
    }
    
    if (config !== undefined && typeof config !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Config must be a string'
      })
    }
    
    if (status !== undefined && typeof status !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status must be a string'
      })
    }

    // Check if pipeline exists
    const existingPipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId }
    })

    if (!existingPipeline) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Pipeline not found'
      })
    }

    // Update the pipeline
    const updatedPipeline = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(config !== undefined && { config }),
        ...(status !== undefined && { status }),
        updatedAt: new Date()
      }
    })

    return {
      success: true,
      data: updatedPipeline
    }
  } catch (error: any) {
    console.error('Error updating pipeline:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
}) 