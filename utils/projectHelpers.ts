import { PrismaClient } from '@prisma/client';
import type { Project, ProjectImage, ProjectTag } from '../types/projects';

const prisma = new PrismaClient();

export function findThumbnailImage(images: ProjectImage[]): ProjectImage | undefined {
  return images.find((image) => image.is_thumbnail);
}

export function findPrimaryTags(tags: ProjectTag[]): ProjectTag[] | undefined {
  return tags.filter((tag) => tag.is_primary);
}

export function findFavoriteProjects(projects: Project[]): Project[] {
  return projects.filter((project) => project.isFavorite);
}

// Fetch all published projects from database
export async function getAllProjects(): Promise<Project[]> {
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
    });

    return projects.map((project) => ({
      ...project,
      tech_tags: project.tags,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

// Fetch featured projects from database
export async function getFeaturedProjects(): Promise<Project[]> {
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
    });

    return projects.map((project) => ({
      ...project,
      tech_tags: project.tags,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching featured projects:', error);
    return [];
  }
}

// Seed initial projects if none exist
export async function seedInitialProjects(userId: number): Promise<void> {
  try {
    const existingProjects = await prisma.project.count();

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
              { tag_name: 'Nuxt 3', is_primary: true, color: '#00dc82' },
              { tag_name: 'TypeScript', is_primary: true, color: '#3178c6' },
              { tag_name: 'AI/ML', is_primary: false, color: '#ff6b6b' },
              { tag_name: 'Prisma', is_primary: false, color: '#2d3748' },
            ],
          },
          images: {
            create: [
              {
                img_name: 'thumbnail',
                img_url: '/images/portfolio-thumb.png',
                is_thumbnail: true,
                alt: 'Portfolio homepage screenshot',
                order: 0,
              },
              {
                img_name: 'projects-page',
                img_url: '/images/portfolio-projects.png',
                is_thumbnail: false,
                alt: 'Projects page screenshot',
                order: 1,
              },
            ],
          },
          testimonials: {
            create: [
              {
                quote: 'Outstanding work! The AI features really make this portfolio stand out.',
                author: 'Sarah Johnson',
                position: 'Design Director',
                company: 'TechCorp',
                rating: 5,
              },
            ],
          },
        },
        {
          project_name: 'LLM Development Platform',
          slug: 'llm-development-platform',
          overview: 'Comprehensive platform for LLM integration and deployment',
          description:
            'A full-stack application that enables developers to integrate, fine-tune, and deploy Large Language Models with an intuitive interface and robust API.',
          isFavorite: true,
          live_url: 'https://llm-platform.example.com',
          github_url: 'https://github.com/example/llm-platform',
          status: 'published',
          category: 'machine-learning',
          featured: true,
          completionDate: '2024-02-28',
          duration: '6 months',
          teamSize: 4,
          userId,
          tags: {
            create: [
              { tag_name: 'Python', is_primary: true, color: '#3776ab' },
              { tag_name: 'FastAPI', is_primary: true, color: '#009688' },
              { tag_name: 'Docker', is_primary: false, color: '#2496ed' },
              { tag_name: 'PostgreSQL', is_primary: false, color: '#336791' },
              { tag_name: 'LLM', is_primary: true, color: '#ff6b6b' },
            ],
          },
          images: {
            create: [
              {
                img_name: 'thumbnail',
                img_url: '/images/llm-platform-thumb.png',
                is_thumbnail: true,
                alt: 'LLM platform dashboard',
                order: 0,
              },
            ],
          },
        },
        {
          project_name: 'E-Commerce Analytics Dashboard',
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
              { tag_name: 'React', is_primary: true, color: '#61dafb' },
              { tag_name: 'Node.js', is_primary: true, color: '#339933' },
              { tag_name: 'MongoDB', is_primary: false, color: '#47a248' },
              { tag_name: 'Chart.js', is_primary: false, color: '#ff6384' },
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
      ];

      for (const projectData of sampleProjects) {
        await prisma.project.create({
          data: projectData,
        });
      }

      console.log('Sample projects seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding projects:', error);
  }
}
