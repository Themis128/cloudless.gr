<<<<<<< HEAD
import {
  createError,
  defineEventHandler,
  getCookie,
  getQuery,
  readBody,
} from 'h3'
import { prisma } from '~/lib/prisma'
import jwt from 'jsonwebtoken'

interface ContactSubmissionUpdate {
  id: number
  status?: string
  notes?: string
}

interface ContactSubmissionDelete {
  id: number
}

/**
 * API to manage contact submissions with pagination
 * Protected route that should only be accessible to authenticated admins
 */
export default defineEventHandler(async (event) => {
  // Check authentication - admin access required
  const cookie = getCookie(event, 'auth_token')
  const authHeader = event.node.req.headers.authorization

  const token =
    cookie ||
    (authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null)

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Admin access required',
    })
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    const decoded = jwt.verify(token, JWT_SECRET) as any

    // Check if user is admin
    if (!decoded || decoded.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden - Admin access required',
      })
    }
  } catch (jwtError) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Invalid token',
    })
  }

  const { method } = event

  // GET request - fetch submissions with pagination and filtering
  if (method === 'GET') {
    try {
      const query = getQuery(event)
      const page = Math.max(1, Number(query.page) || 1)
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 10))
      const skip = (page - 1) * limit
      const status = query.status?.toString() || undefined
      const search = query.search?.toString() || undefined

      // Build the where condition
      const where: any = {}
      
      if (status) {
        where.status = status
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ]
      }

      // Get total count for pagination
      const total = await prisma.contactSubmission.count({ where })

      // Get submissions with pagination
      const submissions = await prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          message: true,
          createdAt: true,
          status: true,
          notes: true,
          metadata: true,
        },
      })

      // Return submissions with pagination metadata
      return {
        success: true,
        data: {
          submissions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1,
          },
        },
      }
    } catch (error) {
      console.error('Error fetching contact submissions:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch contact submissions',
      })
    }
  }

  // PATCH request - update submission status and notes
  if (method === 'PATCH') {
    try {
      const body = await readBody(event) as ContactSubmissionUpdate
      const { id, status, notes } = body

      if (!id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Submission ID is required',
        })
      }

      // Validate status if provided
      if (status && !['new', 'read', 'replied', 'archived'].includes(status)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid status. Must be one of: new, read, replied, archived',
        })
      }

      // Check if submission exists
      const existingSubmission = await prisma.contactSubmission.findUnique({
        where: { id: Number(id) },
      })

      if (!existingSubmission) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Contact submission not found',
        })
      }

      // Update the submission
      const updated = await prisma.contactSubmission.update({
        where: { id: Number(id) },
        data: {
          ...(status && { status }),
          ...(notes !== undefined && { notes }),
        },
      })

      return {
        success: true,
        data: {
          submission: updated,
        },
        message: 'Submission updated successfully',
      }
    } catch (error: any) {
      if (error.statusCode) {
        throw error
      }
      console.error('Error updating contact submission:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update contact submission',
      })
    }
=======
import { defineEventHandler, getQuery, readBody } from 'h3';
import prisma from '../utils/prisma';

/**
 * API to list contact submissions with pagination
 * Protected route that should only be accessible to authenticated admins
 */
export default defineEventHandler(async (event) => {
  // TODO: Add authentication check here before allowing access to submissions
  // For now, this endpoint is available without authentication in development

  const { method } = event;

  // GET request - fetch submissions
  if (method === 'GET') {
    const query = getQuery(event);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = query.status?.toString() || undefined;

    // Build the where condition
    const where = status ? { status } : {};

    // Get total count for pagination
    const total = await prisma.contactSubmission.count({ where });

    // Get submissions with pagination
    const submissions = await prisma.contactSubmission.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        subject: true,
        message: true,
        newsletter: true,
        projectType: true,
        budget: true,
        timeline: true,
        heardFrom: true,
        createdAt: true,
        status: true,
        notes: true,
        assignedTo: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
      },
    });

    // Return submissions with pagination metadata
    return {
      submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // PATCH request - update submission status
  if (method === 'PATCH') {
    const body = await readBody(event);
    const { id, status, notes } = body;

    if (!id) {
      return {
        status: 'error',
        message: 'Submission ID is required',
      };
    }

    // Update the submission
    const updated = await prisma.contactSubmission.update({
      where: { id: Number(id) },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
    });

    return {
      status: 'success',
      message: 'Submission updated successfully',
      submission: updated,
    };
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
  }

  // DELETE request - delete a submission
  if (method === 'DELETE') {
<<<<<<< HEAD
    try {
      const body = await readBody(event) as ContactSubmissionDelete
      const { id } = body

      if (!id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Submission ID is required',
        })
      }

      // Check if submission exists
      const existingSubmission = await prisma.contactSubmission.findUnique({
        where: { id: Number(id) },
      })

      if (!existingSubmission) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Contact submission not found',
        })
      }

      // Delete the submission
      await prisma.contactSubmission.delete({
        where: { id: Number(id) },
      })

      return {
        success: true,
        message: 'Submission deleted successfully',
      }
    } catch (error: any) {
      if (error.statusCode) {
        throw error
      }
      console.error('Error deleting contact submission:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete contact submission',
      })
    }
  }

  // Method not allowed
  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed',
  })
})
=======
    const body = await readBody(event);
    const { id } = body;

    if (!id) {
      return {
        status: 'error',
        message: 'Submission ID is required',
      };
    }

    // Delete the submission
    await prisma.contactSubmission.delete({
      where: { id: Number(id) },
    });

    return {
      status: 'success',
      message: 'Submission deleted successfully',
    };
  }

  // Other methods not supported
  return {
    status: 'error',
    message: 'Method not allowed',
  };
});
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
