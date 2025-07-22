import { PrismaClient } from '@prisma/client';
import { createError, defineEventHandler, getQuery, readBody } from 'h3';

const prisma = new PrismaClient();

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

      if (query.featured !== undefined) {
        where.featured = query.featured === 'true';
      }

      if (query.search) {
        const searchTerm = query.search.toString();
        where.OR = [
          { project_name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { overview: { contains: searchTerm, mode: 'insensitive' } },
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
          orderBy = { project_name: 'asc' };
          break;
        default:
          orderBy = { updatedAt: 'desc' };
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
                email: true,
              },
            },
          },
        }),
        prisma.project.count({ where }),
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

      if (!body.project_name || !body.description || !body.userId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: project_name, description, userId',
        });
      }

      // Generate slug from project name
      const slug = body.project_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const project = await prisma.project.create({
        data: {
          project_name: body.project_name,
          slug,
          overview: body.overview || '',
          description: body.description,
          isFavorite: body.isFavorite || false,
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
          userId: body.userId,
          tags: {
            create:
              body.tags?.map((tag: any) => ({
                tag_name: tag.tag_name,
                is_primary: tag.is_primary || false,
                color: tag.color,
              })) || [],
          },
          images: {
            create:
              body.images?.map((image: any) => ({
                img_name: image.img_name,
                img_url: image.img_url,
                is_thumbnail: image.is_thumbnail || false,
                alt: image.alt,
                caption: image.caption,
                order: image.order || 0,
              })) || [],
          },
        },
        include: {
          tags: true,
          images: true,
          testimonials: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { project };
    }

    // PUT - Update existing project
    if (method === 'PUT') {
      const body = await readBody(event);

      if (!body.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Project ID is required',
        });
      }

      const updateData: any = {};

      // Update only provided fields
      if (body.project_name) updateData.project_name = body.project_name;
      if (body.overview !== undefined) updateData.overview = body.overview;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;
      if (body.live_url !== undefined) updateData.live_url = body.live_url;
      if (body.github_url !== undefined) updateData.github_url = body.github_url;
      if (body.status) updateData.status = body.status;
      if (body.category) updateData.category = body.category;
      if (body.client !== undefined) updateData.client = body.client;
      if (body.clientLogo !== undefined) updateData.clientLogo = body.clientLogo;
      if (body.featured !== undefined) updateData.featured = body.featured;
      if (body.completionDate !== undefined) updateData.completionDate = body.completionDate;
      if (body.duration !== undefined) updateData.duration = body.duration;
      if (body.teamSize !== undefined) updateData.teamSize = body.teamSize;

      const project = await prisma.project.update({
        where: { id: Number(body.id) },
        data: updateData,
        include: {
          tags: true,
          images: true,
          testimonials: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { project };
    }

    // DELETE - Delete project
    if (method === 'DELETE') {
      const body = await readBody(event);

      if (!body.id) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Project ID is required',
        });
      }

      await prisma.project.delete({
        where: { id: Number(body.id) },
      });

      return { message: 'Project deleted successfully' };
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    console.error('Projects API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
