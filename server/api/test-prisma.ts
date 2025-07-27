import { defineEventHandler } from 'h3';
import { getPrismaClient } from '../utils/prisma';

/**
 * Test API route to demonstrate @prisma/nuxt module usage
 * This shows how to use the global Prisma client instance
 */
export default defineEventHandler(async (event) => {
  try {
    const prisma = getPrismaClient()
    
    // Get all contact submissions
    const submissions = await prisma.contactSubmission.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get count of all submissions
    const totalCount = await prisma.contactSubmission.count();

    return {
      status: 'success',
      message: 'Prisma integration working correctly',
      data: {
        submissions,
        totalCount,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Prisma test error:', error);
    return {
      status: 'error',
      message: 'Failed to query database',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
