import { defineEventHandler, getQuery, createError } from 'h3'
import { getPrismaClient } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const prisma = getPrismaClient()
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 10
    const search = query.search as string
    const type = query.type as string
    const status = query.status as string
    const sortBy = query.sortBy as string || 'createdAt'
    const sortOrder = query.sortOrder as string || 'desc'

    // Build where clause
    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    if (type) {
      where.type = type
    }
    
    if (status) {
      where.status = status
    }

    // Get total count
    const total = await prisma.model.count({ where })
    
    // Get models with pagination
    const models = await prisma.model.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        trainings: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      models,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev
      }
    }
  } catch (error) {
    console.error('Error fetching models:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch models'
    })
  }
}) 