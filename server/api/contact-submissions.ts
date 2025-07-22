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
  }

  // DELETE request - delete a submission
  if (method === 'DELETE') {
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
