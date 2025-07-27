import { PrismaClient } from '@prisma/client'

// Prisma composable for direct database access (server-side only)
export const usePrisma = () => {
  const prisma = new PrismaClient()

  return {
    prisma,
    // User operations
    async getUserById(id: number) {
      return await prisma.user.findUnique({
        where: { id },
      })
    },

    async getUserByEmail(email: string) {
      return await prisma.user.findUnique({
        where: { email },
      })
    },

    async createUser(userData: any) {
      return await prisma.user.create({
        data: userData,
      })
    },

    // Project operations
    async getProjects() {
      return await prisma.project.findMany({
        include: {
          user: true,
          tags: true,
          images: true,
          testimonials: true,
        },
      })
    },

    async getProjectById(id: number) {
      return await prisma.project.findUnique({
        where: { id },
        include: {
          user: true,
          tags: true,
          images: true,
          testimonials: true,
        },
      })
    },

    async createProject(projectData: any) {
      return await prisma.project.create({
        data: projectData,
      })
    },

    // Contact operations
    async createContactSubmission(contactData: any) {
      return await prisma.contactSubmission.create({
        data: contactData,
      })
    },

    async getContactSubmissions() {
      return await prisma.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
      })
    },

    // Bot operations
    async getBotById(id: string) {
      return await prisma.bot.findUnique({
        where: { id: String(id) },
        include: {
          user: true,
          deployments: true,
        },
      })
    },

    async updateBot(id: string, botData: any) {
      return await prisma.bot.update({
        where: { id: String(id) },
        data: {
          name: botData.name,
          description: botData.description,
          config: JSON.stringify({
            modelType: botData.modelType,
            apiKey: botData.apiKey,
            systemPrompt: botData.systemPrompt,
          }),
          status: botData.status,
          updatedAt: new Date(),
        },
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
            systemPrompt: botData.systemPrompt,
          }),
          status: botData.status,
          userId: botData.userId,
        },
      })
    },

    async getBots() {
      return await prisma.bot.findMany({
        include: {
          user: true,
          deployments: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    },

    // Model operations
    async getModelById(id: string) {
      return await prisma.model.findUnique({
        where: { id: String(id) },
        include: {
          user: true,
          trainings: true,
        },
      })
    },

    async updateModel(id: string, modelData: any) {
      return await prisma.model.update({
        where: { id: String(id) },
        data: {
          name: modelData.name,
          description: modelData.description,
          type: modelData.type,
          config: JSON.stringify(modelData.config),
          status: modelData.status,
          // accuracy: modelData.accuracy, // Removed - not in schema
          updatedAt: new Date(),
        },
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
          // accuracy: modelData.accuracy, // Removed - not in schema
          userId: modelData.userId,
        },
      })
    },

    async getModels() {
      return await prisma.model.findMany({
        include: {
          user: true,
          trainings: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    },

    // Pipeline operations
    async getPipelineById(id: string) {
      return await prisma.pipeline.findUnique({
        where: { id: String(id) },
        include: {
          user: true,
          runs: true,
        },
      })
    },

    async updatePipeline(id: string, pipelineData: any) {
      return await prisma.pipeline.update({
        where: { id: String(id) },
        data: {
          name: pipelineData.name,
          description: pipelineData.description,
          config: JSON.stringify(pipelineData.config),
          status: pipelineData.status,
          updatedAt: new Date(),
        },
      })
    },

    async createPipeline(pipelineData: any) {
      return await prisma.pipeline.create({
        data: {
          name: pipelineData.name,
          description: pipelineData.description,
          config: JSON.stringify(pipelineData.config),
          status: pipelineData.status,
          userId: pipelineData.userId,
        },
      })
    },

    async getPipelines() {
      return await prisma.pipeline.findMany({
        include: {
          user: true,
          runs: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    },

    // Training session operations
    async createTrainingSession(trainingData: any) {
      return await prisma.modelTraining.create({
        data: {
          status: trainingData.status || 'pending',
          // config: JSON.stringify({ // Removed - not in schema
          //   name: trainingData.name,
          //   baseModel: trainingData.baseModel,
          //   trainingType: trainingData.trainingType,
          //   description: trainingData.description,
          //   parameters: trainingData.parameters
          // }),
          modelId: trainingData.modelId || '1', // Default model ID
          // startedAt: trainingData.status === 'running' ? new Date() : null, // Removed - not in schema
        },
      })
    },

    async updateTrainingSession(id: string, trainingData: any) {
      return await prisma.modelTraining.update({
        where: { id: String(id) },
        data: {
          status: trainingData.status,
          // logs: trainingData.logs ? JSON.stringify(trainingData.logs) : null, // Removed - not in schema
          // metrics: trainingData.metrics // Removed - not in schema
          //   ? JSON.stringify(trainingData.metrics)
          //   : null,
          // startedAt: trainingData.status === 'running' ? new Date() : undefined, // Removed - not in schema
          // completedAt: // Removed - not in schema
          //   trainingData.status === 'completed' ? new Date() : undefined,
        },
      })
    },

    async getTrainingSessions() {
      return await prisma.modelTraining.findMany({
        include: {
          model: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    },

    async getTrainingSessionById(id: string) {
      return await prisma.modelTraining.findUnique({
        where: { id: String(id) },
        include: {
          model: true,
        },
      })
    },
  }
}
