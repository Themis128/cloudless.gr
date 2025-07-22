// Example: Using Prisma Accelerate Caching Features
// This file demonstrates how to use caching with Prisma Postgres

import { prisma } from '../lib/prisma'

// Example 1: Time-To-Live (TTL) Caching
// Cache results for 60 seconds
export async function getCachedProjects() {
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      _count: {
        select: {
          training_sessions: true,
          model_versions: true
        }
      }
    },
    cacheStrategy: {
      ttl: 60, // Cache for 60 seconds
    },
  })

  return projects
}

// Example 2: Stale-While-Revalidate (SWR) Caching
// Serve stale data while fetching fresh data in the background
export async function getProjectsWithSWR() {
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      training_sessions: {
        where: {
          status: 'completed'
        },
        orderBy: {
          completed_at: 'desc'
        },
        take: 5
      }
    },
    cacheStrategy: {
      swr: 60, // Serve stale data for 60 seconds while revalidating
      ttl: 300, // Keep in cache for 5 minutes total
    },
  })

  return projects
}

// Example 3: Cache Tags for Selective Invalidation
export async function getCachedTrainingSessions(projectId: string) {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      project_id: projectId
    },
    include: {
      project: true,
      model_versions: true
    },
    orderBy: {
      created_at: 'desc'
    },
    cacheStrategy: {
      ttl: 120, // Cache for 2 minutes
      tags: [`project:${projectId}`, 'training-sessions'], // Tags for invalidation
    },
  })

  return sessions
}

// Example 4: Conditional Caching Based on Data
export async function getActiveProjects() {
  const projects = await prisma.project.findMany({
    where: {
      status: 'active'
    },
    include: {
      owner: true,
      training_sessions: {
        where: {
          status: 'running'
        }
      }
    },
    cacheStrategy: {
      ttl: 30, // Short cache for active data
      swr: 15, // Quick revalidation
    },
  })

  return projects
}

// Example 5: Cache Invalidation
export async function updateProjectAndInvalidateCache(
  projectId: string, 
  data: { name?: string; status?: string }
) {
  // Update the project
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data,
  })

  // Invalidate related caches (this would be handled automatically by Prisma Accelerate
  // based on the queries that affect this data, but you can also manually invalidate)
  
  return updatedProject
}

// Example 6: Performance Comparison
export async function demonstrateCachingPerformance() {
  console.log('🚀 Demonstrating Prisma Accelerate Caching...')
  
  // First request - will hit the database
  console.time('First request (cache miss)')
  await getCachedProjects()
  console.timeEnd('First request (cache miss)')
  
  // Second request - will hit the cache
  console.time('Second request (cache hit)')
  await getCachedProjects()
  console.timeEnd('Second request (cache hit)')
  
  console.log('✅ Notice the significant performance improvement on the cached request!')
}

// Example 7: Complex Query with Caching
export async function getDashboardData() {
  // This complex aggregation query benefits greatly from caching
  const dashboardData = await prisma.$transaction([
    // Active projects count
    prisma.project.count({
      where: { status: 'active' }
    }),
    
    // Recent training sessions
    prisma.trainingSession.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        project: {
          select: { name: true }
        }
      },
      cacheStrategy: {
        ttl: 60,
        tags: ['dashboard', 'training-sessions']
      }
    }),
    
    // Model deployment stats
    prisma.deployment.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      cacheStrategy: {
        ttl: 300, // Cache deployment stats for 5 minutes
        tags: ['dashboard', 'deployments']
      }
    })
  ])

  return {
    activeProjects: dashboardData[0],
    recentTraining: dashboardData[1],
    deploymentStats: dashboardData[2]
  }
}

// Usage Examples:
/*
// In your API routes or components:

// Basic caching
const projects = await getCachedProjects()

// SWR caching for better UX
const projectsWithSWR = await getProjectsWithSWR()

// Performance demonstration
await demonstrateCachingPerformance()

// Dashboard with complex caching
const dashboard = await getDashboardData()
*/

export {
  getCachedProjects,
  getProjectsWithSWR,
  getCachedTrainingSessions,
  getActiveProjects,
  updateProjectAndInvalidateCache,
  demonstrateCachingPerformance,
  getDashboardData
}