import { defineEventHandler, readBody, getQuery, createError } from 'h3'
import { prisma } from '~/lib/prisma'
import { requireAuth } from '~/server/middleware/auth'

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAuth(event, 'admin')
  
  const { method } = event;

  try {
    // TODO: Add admin authentication check here

    // GET - Fetch users with pagination and filtering
    if (method === 'GET') {
      const query = getQuery(event);
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      // Build filter conditions
      const where: any = {};

      if (query.status && query.status !== 'all') {
        // Note: status is not in our User model, but we can filter by role
        if (query.status === 'active') {
          where.role = 'user';
        } else if (query.status === 'admin') {
          where.role = 'admin';
        }
      }

      if (query.search) {
        const searchTerm = query.search.toString();
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      // Determine sort order
      let orderBy = {};
      switch (query.sortBy) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'oldest':
          orderBy = { createdAt: 'asc' };
          break;
        case 'name':
          orderBy = { name: 'asc' };
          break;
        default:
          orderBy = { createdAt: 'desc' };
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            // Don't return password
            _count: {
              select: {
                projects: true,
                bots: true,
                models: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      // Map users to include status field for compatibility
      const mappedUsers = users.map((user) => ({
        ...user,
        status: user.role === 'admin' ? 'admin' : 'active', // Simple mapping
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }));

      return {
        data: mappedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }

    // POST - Create new user (admin only)
    if (method === 'POST') {
      const body = await readBody(event);

      if (!body.name || !body.email || !body.password) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: name, email, password',
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Email already exists',
        });
      }

      // Hash password (using same method as auth)
      const crypto = await import('crypto');
      const hashedPassword = crypto.createHash('sha256').update(body.password).digest('hex');

      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: body.role || 'user',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        user: {
          ...user,
          status: user.role === 'admin' ? 'admin' : 'active',
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    }

    // PUT - Update user
    if (method === 'PUT') {
      const body = await readBody(event);

      if (!body.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'User ID is required',
        });
      }

      const updateData: any = {};

      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email;
      if (body.role) updateData.role = body.role;

      // Hash password if provided
      if (body.password) {
        const crypto = await import('crypto');
        updateData.password = crypto.createHash('sha256').update(body.password).digest('hex');
      }

      const user = await prisma.user.update({
        where: { id: Number(body.id) },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        user: {
          ...user,
          status: user.role === 'admin' ? 'admin' : 'active',
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      };
    }

    // DELETE - Delete user
    if (method === 'DELETE') {
      const body = await readBody(event);

      if (!body.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'User ID is required',
        });
      }

      await prisma.user.delete({
        where: { id: Number(body.id) },
      });

      return { message: 'User deleted successfully' };
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    console.error('Admin users API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
