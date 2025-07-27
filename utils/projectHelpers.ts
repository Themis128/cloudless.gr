import { prisma } from '~/lib/prisma'

export function findThumbnailImage(images: any[]): any | undefined {
  return images.find(image => image.is_thumbnail)
}

export function findPrimaryTags(tags: any[]): any[] {
  return tags.filter(tag => tag.is_primary)
}

export function findFavoriteProjects(projects: any[]): any[] {
  return projects.filter(project => project.isFavorite)
}

// Fetch all published projects from database
export async function getAllProjects(): Promise<any[]> {
  try {
    const projects = await prisma.project.findMany({
      where: { status: 'published' },
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
      orderBy: { updatedAt: 'desc' },
    })

    return projects
  } catch (error) {
    // Error handled silently in production
    return []
  }
}

// Fetch featured projects from database
export async function getFeaturedProjects(): Promise<any[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        status: 'published',
        featured: true,
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
      orderBy: { updatedAt: 'desc' },
      take: 6,
    })

    return projects
  } catch (error) {
    // Error handled silently in production
    return []
  }
}

// Seed initial projects if none exist
export async function seedInitialProjects(userId: number): Promise<void> {
  try {
    const existingProjects = await prisma.project.count()

    if (existingProjects === 0) {
      const sampleProjects = [
        {
          project_name: 'AI-Powered Portfolio',
          slug: 'ai-powered-portfolio',
          overview: 'A modern portfolio built with AI assistance',
          description:
            'Showcase your work and skills with a blazing fast portfolio site enhanced by AI capabilities for content generation and user interaction.',
          isFavorite: true,
          live_url: 'https://portfolio.example.com',
          github_url: 'https://github.com/example/ai-portfolio',
          status: 'published',
          category: 'web-development',
          featured: true,
          completionDate: '2024-03-15',
          duration: '3 months',
          teamSize: 2,
          userId,
          tags: {
            create: [
              { name: 'Nuxt 3', primary: true, color: '#00dc82' },
              { name: 'TypeScript', primary: true, color: '#3178c6' },
              {
                name: 'AI Integration',
                primary: false,
                color: '#ff6b6b',
              },
              { name: 'Tailwind CSS', primary: false, color: '#06b6d4' },
            ],
          },
          images: {
            create: [
              {
                img_name: 'thumbnail',
                img_url: '/images/portfolio-thumb.png',
                is_thumbnail: true,
                alt: 'AI Portfolio thumbnail',
                order: 0,
              },
            ],
          },
        },
        {
          project_name: 'E-commerce Analytics Dashboard',
          slug: 'ecommerce-analytics-dashboard',
          overview: 'Real-time analytics and insights for e-commerce businesses',
          description:
            'A comprehensive dashboard providing real-time analytics, sales tracking, and business intelligence for e-commerce platforms.',
          isFavorite: false,
          live_url: 'https://analytics.example.com',
          github_url: 'https://github.com/example/ecommerce-analytics',
          status: 'published',
          category: 'web-development',
          featured: false,
          completionDate: '2024-01-15',
          duration: '4 months',
          teamSize: 3,
          userId,
          tags: {
            create: [
              { name: 'React', primary: true, color: '#61dafb' },
              { name: 'Node.js', primary: true, color: '#339933' },
              { name: 'MongoDB', primary: false, color: '#47a248' },
              { name: 'Chart.js', primary: false, color: '#ff6384' },
            ],
          },
          images: {
            create: [
              {
                img_name: 'thumbnail',
                img_url: '/images/analytics-thumb.png',
                is_thumbnail: true,
                alt: 'Analytics dashboard overview',
                order: 0,
              },
            ],
          },
        },
      ]

      for (const projectData of sampleProjects) {
        await prisma.project.create({
          data: projectData,
        })
      }

      // Sample projects seeded successfully
    }
  } catch (error) {
    // Error handled silently in production
  }
}
