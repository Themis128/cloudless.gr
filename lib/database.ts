import { prisma } from './prisma'

// Database service functions
export const databaseService = {
  prisma,
  
  // User operations
  async getUserById(id: number) {
    return await prisma.user.findUnique({
      where: { id }
    })
  },

  async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    })
  },

  async createUser(userData: any) {
    return await prisma.user.create({
      data: userData
    })
  },

  // Project operations
  async getProjects() {
    return await prisma.project.findMany({
      include: {
        user: true,
        tags: true,
        images: true,
        testimonials: true
      }
    })
  },

  async getProjectById(id: number) {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        user: true,
        tags: true,
        images: true,
        testimonials: true
      }
    })
  },

  async createProject(projectData: any) {
    return await prisma.project.create({
      data: projectData
    })
  },

  // Contact operations
  async createContactSubmission(contactData: any) {
    return await prisma.contactSubmission.create({
      data: contactData
    })
  },

  async getContactSubmissions() {
    return await prisma.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' }
    })
  },

  // Health check
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'healthy', connected: true }
    } catch (error: any) {
      return { status: 'unhealthy', connected: false, error: error?.message || 'Unknown error' }
    }
  }
}