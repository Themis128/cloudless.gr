import { defineEventHandler, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  try {
    // Get total user count
    const total = await prisma.user.count()
    
    // Get active user count
    const activeUsers = await prisma.user.count({
      where: {
        isActive: true
      }
    })
    
    // Get verified user count
    const verifiedUsers = await prisma.user.count({
      where: {
        isVerified: true
      }
    })
    
    // Get recent users (last 10)
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            sessions: true,
            loginHistory: true
          }
        }
      }
    })
    
    // Get user statistics by role
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    })
    
    // Get users created in the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentCount = await prisma.user.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })
    
    // Get users who logged in today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayActiveUsers = await prisma.user.count({
      where: {
        lastLogin: {
          gte: today
        }
      }
    })
    
    return {
      success: true,
      total,
      activeUsers,
      verifiedUsers,
      todayActiveUsers,
      recentCount,
      recentUsers,
      roleStats: roleStats.map(stat => ({
        role: stat.role,
        count: stat._count.role
      })),
      summary: {
        total,
        active: activeUsers,
        verified: verifiedUsers,
        admin: roleStats.find(s => s.role === 'admin')?._count.role || 0,
        user: roleStats.find(s => s.role === 'user')?._count.role || 0
      }
    }
    
  } catch (error) {
    console.error('Error fetching admin users:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user data'
    })
  }
}) 