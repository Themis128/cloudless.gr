import { PrismaClient } from '@prisma/client'

// Prisma composable for direct database access (server-side only)
export const usePrisma = () => {
  const prisma = new PrismaClient()
  
  return {
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

    // Bot operations
    async getBotById(id: number) {
      return await prisma.bot.findUnique({
        where: { id: Number(id) },
        include: {
          user: true,
          deployments: true
        }
      })
    },

    async updateBot(id: number, botData: any) {
      return await prisma.bot.update({
        where: { id: Number(id) },
        data: {
          name: botData.name,
          description: botData.description,
          config: JSON.stringify({
            modelType: botData.modelType,
            apiKey: botData.apiKey,
            systemPrompt: botData.systemPrompt
          }),
          status: botData.status,
          updatedAt: new Date()
        }
      })
    },

    async createBot(botData: any) {
      return await prisma.bot.create({
        data: {
          name: botData.name,
          description: botData.description,
          config: JSON.stringify({
            modelType: botData.modelType,
            apiKey: botData.apiKey,
            systemPrompt: botData.systemPrompt
          }),
          status: botData.status,
          userId: botData.userId
        }
      })
    },

    async getBots() {
      return await prisma.bot.findMany({
        include: {
          user: true,
          deployments: true
        },
        orderBy: { createdAt: 'desc' }
      })
    },

    // Model operations
    async getModelById(id: number) {
      return await prisma.model.findUnique({
        where: { id: Number(id) },
        include: {
          user: true,
          trainings: true
        }
      })
    },

    async updateModel(id: number, modelData: any) {
      return await prisma.model.update({
        where: { id: Number(id) },
        data: {
          name: modelData.name,
          description: modelData.description,
          type: modelData.type,
          config: JSON.stringify(modelData.config),
          status: modelData.status,
          accuracy: modelData.accuracy,
          updatedAt: new Date()
        }
      })
    },

    async createModel(modelData: any) {
      return await prisma.model.create({
        data: {
          name: modelData.name,
          description: modelData.description,
          type: modelData.type,
          config: JSON.stringify(modelData.config),
          status: modelData.status,
          accuracy: modelData.accuracy,
          userId: modelData.userId
        }
      })
    },

    async getModels() {
      return await prisma.model.findMany({
        include: {
          user: true,
          trainings: true
        },
        orderBy: { createdAt: 'desc' }
      })
    },

    // Pipeline operations
    async getPipelineById(id: number) {
      return await prisma.pipeline.findUnique({
        where: { id: Number(id) },
        include: {
          user: true,
          runs: true
        }
      })
    },

    async updatePipeline(id: number, pipelineData: any) {
      return await prisma.pipeline.update({
        where: { id: Number(id) },
        data: {
          name: pipelineData.name,
          description: pipelineData.description,
          config: JSON.stringify(pipelineData.config),
          status: pipelineData.status,
          updatedAt: new Date()
        }
      })
    },

    async createPipeline(pipelineData: any) {
      return await prisma.pipeline.create({
        data: {
          name: pipelineData.name,
          description: pipelineData.description,
          config: JSON.stringify(pipelineData.config),
          status: pipelineData.status,
          userId: pipelineData.userId
        }
      })
    },

    async getPipelines() {
      return await prisma.pipeline.findMany({
        include: {
          user: true,
          runs: true
        },
        orderBy: { createdAt: 'desc' }
      })
    },

    // Training session operations
    async createTrainingSession(trainingData: any) {
      return await prisma.modelTraining.create({
        data: {
          status: trainingData.status || 'pending',
          config: JSON.stringify({
            name: trainingData.name,
            baseModel: trainingData.baseModel,
            trainingType: trainingData.trainingType,
            description: trainingData.description,
            parameters: trainingData.parameters
          }),
          modelId: trainingData.modelId || 1, // Default model ID
          startedAt: trainingData.status === 'running' ? new Date() : null
        }
      })
    },

    async updateTrainingSession(id: number, trainingData: any) {
      return await prisma.modelTraining.update({
        where: { id },
        data: {
          status: trainingData.status,
          logs: trainingData.logs ? JSON.stringify(trainingData.logs) : null,
          metrics: trainingData.metrics ? JSON.stringify(trainingData.metrics) : null,
          startedAt: trainingData.status === 'running' ? new Date() : undefined,
          completedAt: trainingData.status === 'completed' ? new Date() : undefined
        }
      })
    },

    async getTrainingSessions() {
      return await prisma.modelTraining.findMany({
        include: {
          model: true
        },
        orderBy: { createdAt: 'desc' }
      })
    },

    async getTrainingSessionById(id: number) {
      return await prisma.modelTraining.findUnique({
        where: { id },
        include: {
          model: true
        }
      })
    }
  }
} 