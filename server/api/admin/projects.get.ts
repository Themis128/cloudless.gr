import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Get total project count
    const total = await prisma.project.count()
    
    // Get recent projects (last 10)
    const recentProjects = await prisma.project.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        project_name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        featured: true,
        _count: {
          select: {
            images: true,
            tags: true,
            testimonials: true
          }
        }
      }
    })
    
    // Get project statistics by status
    const statusStats = await prisma.project.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })
    
    // Get projects created in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentCount = await prisma.project.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })
    
    return {
      success: true,
      total,
      recentCount,
      recentProjects,
      statusStats: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.status
      })),
      summary: {
        total,
        active: statusStats.find(s => s.status === 'active')?._count.status || 0,
        inactive: statusStats.find(s => s.status === 'inactive')?._count.status || 0,
        draft: statusStats.find(s => s.status === 'draft')?._count.status || 0,
        archived: statusStats.find(s => s.status === 'archived')?._count.status || 0
      }
    }
    
  } catch (error) {
    console.error('Error fetching admin projects:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch project data'
    })
  }
}) 