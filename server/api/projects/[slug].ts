import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '~/lib/prisma'

export default defineEventHandler(async (event) => {
  const { method } = event;
  const slug = getRouterParam(event, 'slug');

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project slug is required',
    });
  }

  try {
    // GET - Fetch single project by slug
    if (method === 'GET') {
      const project = await prisma.project.findUnique({
        where: { slug },
        include: {
          tags: true,
          images: {
            orderBy: { order: 'asc' },
          },
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

      if (!project) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Project not found',
        });
      }

      // Get related projects (same category or similar tags)
      const relatedProjects = await prisma.project.findMany({
        where: {
          AND: [
            { id: { not: project.id } },
            { status: 'published' },
            {
              OR: [
                { category: project.category },
                {
                  tags: {
                    some: {
                      tag_name: {
                        in: project.tags.map((tag) => tag.tag_name),
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        take: 3,
        include: {
          tags: true,
          images: {
            where: { is_thumbnail: true },
          },
        },
      });

      return {
        project: {
          ...project,
          relatedProjects,
        },
      };
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    });
  } catch (error) {
    if ((error as any).statusCode) {
      throw error;
    }

    console.error('Project by slug API error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    });
  }
});
