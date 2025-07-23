import { defineEventHandler, getQuery, readBody, createError } from 'h3';
import { prisma } from '~/lib/prisma';

export default defineEventHandler(async (event) => {
  const { method } = event;

  try {
    // GET - Fetch projects with optional filtering
    if (method === 'GET') {
      const query = getQuery(event);
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Build filter conditions
      const where: any = {};
      
      if (query.category) {
        where.category = query.category;
      }
      
      if (query.status) {
        where.status = query.status;
      }
      
      if (query.featured === 'true') {
        where.featured = true;
      }
      
      if (query.search) {
        where.OR = [
          { project_name: { contains: query.search as string, mode: 'insensitive' } },
          { description: { contains: query.search as string, mode: 'insensitive' } },
          { overview: { contains: query.search as string, mode: 'insensitive' } }
        ];
      }

      // Build sort conditions
      const orderBy: any = {};
      if (query.sortBy) {
        orderBy[query.sortBy as string] = query.sortOrder || 'desc';
      } else {
        orderBy.updatedAt = 'desc';
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            tags: true,
            images: true,
            testimonials: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }),
        prisma.project.count({ where })
      ]);

      return {
        projects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }

    // POST - Create new project
    if (method === 'POST') {
      const body = await readBody(event);
      
      // Validate required fields
      if (!body.project_name || !body.slug || !body.overview || !body.description) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: project_name, slug, overview, description'
        });
      }

      // Check if slug already exists
      const existingProject = await prisma.project.findUnique({
        where: { slug: body.slug }
      });

      if (existingProject) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Project with this slug already exists'
        });
      }

      // Create project
      const project = await prisma.project.create({
        data: {
          project_name: body.project_name,
          slug: body.slug,
          overview: body.overview,
          description: body.description,
          live_url: body.live_url,
          github_url: body.github_url,
          status: body.status || 'draft',
          category: body.category || 'other',
          client: body.client,
          clientLogo: body.clientLogo,
          featured: body.featured || false,
          completionDate: body.completionDate,
          duration: body.duration,
          teamSize: body.teamSize,
          userId: body.userId || 1, // Default to user ID 1 for now
        },
        include: {
          tags: true,
          images: true,
          testimonials: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return project;
    }

    // PUT - Update project
    if (method === 'PUT') {
      const body = await readBody(event);
      
      if (!body.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Project ID is required'
        });
      }

      // Check if project exists
      const existingProject = await prisma.project.findUnique({
        where: { id: Number(body.id) }
      });

      if (!existingProject) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Project not found'
        });
      }

      // Update project
      const project = await prisma.project.update({
        where: { id: Number(body.id) },
        data: {
          project_name: body.project_name,
          slug: body.slug,
          overview: body.overview,
          description: body.description,
          live_url: body.live_url,
          github_url: body.github_url,
          status: body.status,
          category: body.category,
          client: body.client,
          clientLogo: body.clientLogo,
          featured: body.featured,
          completionDate: body.completionDate,
          duration: body.duration,
          teamSize: body.teamSize,
        },
        include: {
          tags: true,
          images: true,
          testimonials: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return project;
    }

    // DELETE - Delete project
    if (method === 'DELETE') {
      const query = getQuery(event);
      
      if (!query.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Project ID is required'
        });
      }

      // Check if project exists
      const existingProject = await prisma.project.findUnique({
        where: { id: Number(query.id) }
      });

      if (!existingProject) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Project not found'
        });
      }

      // Delete project (this will cascade delete related records)
      await prisma.project.delete({
        where: { id: Number(query.id) }
      });

      return { message: 'Project deleted successfully' };
    }

    // Method not allowed
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed'
    });

  } catch (error: any) {
    console.error('Projects API error:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    });
  }
});
