// Mock database service - replace with your actual database implementation
import type { 
  Profile, 
  Project, 
  TrainingSession, 
  ModelVersion, 
  Deployment,
  AnalyticsPipeline,
  Bot,
  ContactMessage,
  SupportRequest,
  Todo,
  Prisma
} from '~/generated/prisma'

// Mock data store
const mockData = {
  profiles: [] as Profile[],
  projects: [] as Project[],
  trainingSessions: [] as TrainingSession[],
  modelVersions: [] as ModelVersion[],
  deployments: [] as Deployment[],
  analyticsPipelines: [] as AnalyticsPipeline[],
  bots: [] as Bot[],
  contactMessages: [] as ContactMessage[],
  supportRequests: [] as SupportRequest[],
  todos: [] as Todo[]
}

// User Management
export const userService = {
  async createProfile(data: any): Promise<Profile> {
    const profile = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.profiles.push(profile)
    return profile
  },

  async getProfile(id: string): Promise<Profile | null> {
    return mockData.profiles.find(p => p.id === id) || null
  },

  async getProfileByEmail(email: string): Promise<Profile | null> {
    return mockData.profiles.find(p => p.email === email) || null
  },

  async updateProfile(id: string, data: any): Promise<Profile> {
    const index = mockData.profiles.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Profile not found')
    mockData.profiles[index] = { ...mockData.profiles[index], ...data }
    return mockData.profiles[index]
  },

  async deleteProfile(id: string): Promise<Profile> {
    const index = mockData.profiles.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Profile not found')
    return mockData.profiles.splice(index, 1)[0]
  },

  async listProfiles(page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const profiles = mockData.profiles.slice(skip, skip + limit)
    return {
      profiles,
      total: mockData.profiles.length,
      page,
      pages: Math.ceil(mockData.profiles.length / limit)
    }
  }
}

// Project Management
export const projectService = {
  async createProject(data: any): Promise<Project> {
    const project = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.projects.push(project)
    return project
  },

  async getProject(id: string): Promise<Project | null> {
    return mockData.projects.find(p => p.id === id) || null
  },

  async updateProject(id: string, data: any): Promise<Project> {
    const index = mockData.projects.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Project not found')
    mockData.projects[index] = { ...mockData.projects[index], ...data }
    return mockData.projects[index]
  },

  async deleteProject(id: string): Promise<Project> {
    const index = mockData.projects.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Project not found')
    return mockData.projects.splice(index, 1)[0]
  },

  async listProjects(ownerId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    let projects = mockData.projects
    if (ownerId) projects = projects.filter(p => p.owner_id === ownerId)
    const paginated = projects.slice(skip, skip + limit)
    return {
      projects: paginated,
      total: projects.length,
      page,
      pages: Math.ceil(projects.length / limit)
    }
  },

  async addCollaborator(projectId: string, userId: string, role = 'viewer') {
    return { id: Date.now().toString(), project_id: projectId, user_id: userId, role }
  }
}

// Training and ML
export const trainingService = {
  async createTrainingSession(data: any): Promise<TrainingSession> {
    const session = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.trainingSessions.push(session)
    return session
  },

  async getTrainingSession(id: string): Promise<TrainingSession | null> {
    return mockData.trainingSessions.find(s => s.id === id) || null
  },

  async updateTrainingSession(id: string, data: any): Promise<TrainingSession> {
    const index = mockData.trainingSessions.findIndex(s => s.id === id)
    if (index === -1) throw new Error('Training session not found')
    mockData.trainingSessions[index] = { ...mockData.trainingSessions[index], ...data }
    return mockData.trainingSessions[index]
  },

  async listTrainingSessions(projectId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    let sessions = mockData.trainingSessions
    if (projectId) sessions = sessions.filter(s => s.project_id === projectId)
    const paginated = sessions.slice(skip, skip + limit)
    return {
      sessions: paginated,
      total: sessions.length,
      page,
      pages: Math.ceil(sessions.length / limit)
    }
  }
}

// Model Versions
export const modelService = {
  async createModelVersion(data: any): Promise<ModelVersion> {
    const version = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.modelVersions.push(version)
    return version
  },

  async getModelVersion(id: string): Promise<ModelVersion | null> {
    return mockData.modelVersions.find(v => v.id === id) || null
  },

  async listModelVersions(projectId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    let versions = mockData.modelVersions
    if (projectId) versions = versions.filter(v => v.project_id === projectId)
    const paginated = versions.slice(skip, skip + limit)
    return {
      versions: paginated,
      total: versions.length,
      page,
      pages: Math.ceil(versions.length / limit)
    }
  }
}

// Deployments
export const deploymentService = {
  async createDeployment(data: any): Promise<Deployment> {
    const deployment = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.deployments.push(deployment)
    return deployment
  },

  async getDeployment(id: string): Promise<Deployment | null> {
    return mockData.deployments.find(d => d.id === id) || null
  },

  async updateDeployment(id: string, data: any): Promise<Deployment> {
    const index = mockData.deployments.findIndex(d => d.id === id)
    if (index === -1) throw new Error('Deployment not found')
    mockData.deployments[index] = { ...mockData.deployments[index], ...data }
    return mockData.deployments[index]
  },

  async listDeployments(page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const deployments = mockData.deployments.slice(skip, skip + limit)
    return {
      deployments,
      total: mockData.deployments.length,
      page,
      pages: Math.ceil(mockData.deployments.length / limit)
    }
  }
}

// Analytics
export const analyticsService = {
  async createPipeline(data: any): Promise<AnalyticsPipeline> {
    const pipeline = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.analyticsPipelines.push(pipeline)
    return pipeline
  },

  async getPipeline(id: string): Promise<AnalyticsPipeline | null> {
    return mockData.analyticsPipelines.find(p => p.id === id) || null
  },

  async listPipelines(projectId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    let pipelines = mockData.analyticsPipelines
    if (projectId) pipelines = pipelines.filter(p => p.project_id === projectId)
    const paginated = pipelines.slice(skip, skip + limit)
    return {
      pipelines: paginated,
      total: pipelines.length,
      page,
      pages: Math.ceil(pipelines.length / limit)
    }
  }
}

// Bots
export const botService = {
  async createBot(data: any): Promise<Bot> {
    const bot = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.bots.push(bot)
    return bot
  },

  async getBot(id: string): Promise<Bot | null> {
    return mockData.bots.find(b => b.id === id) || null
  },

  async updateBot(id: string, data: any): Promise<Bot> {
    const index = mockData.bots.findIndex(b => b.id === id)
    if (index === -1) throw new Error('Bot not found')
    mockData.bots[index] = { ...mockData.bots[index], ...data }
    return mockData.bots[index]
  },

  async listBots(page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const bots = mockData.bots.slice(skip, skip + limit)
    return {
      bots,
      total: mockData.bots.length,
      page,
      pages: Math.ceil(mockData.bots.length / limit)
    }
  }
}

// Contact and Support
export const contactService = {
  async createContactMessage(data: any): Promise<ContactMessage> {
    const message = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.contactMessages.push(message)
    return message
  },

  async createSupportRequest(data: any): Promise<SupportRequest> {
    const request = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.supportRequests.push(request)
    return request
  },

  async listContactMessages(page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const messages = mockData.contactMessages.slice(skip, skip + limit)
    return {
      messages,
      total: mockData.contactMessages.length,
      page,
      pages: Math.ceil(mockData.contactMessages.length / limit)
    }
  }
}

// Simple Todo operations
export const todoService = {
  async createTodo(data: any): Promise<Todo> {
    const todo = { id: Date.now().toString(), ...data, created_at: new Date() }
    mockData.todos.push(todo)
    return todo
  },

  async getTodo(id: string): Promise<Todo | null> {
    return mockData.todos.find(t => t.id === id) || null
  },

  async updateTodo(id: string, data: any): Promise<Todo> {
    const index = mockData.todos.findIndex(t => t.id === id)
    if (index === -1) throw new Error('Todo not found')
    mockData.todos[index] = { ...mockData.todos[index], ...data }
    return mockData.todos[index]
  },

  async deleteTodo(id: string): Promise<Todo> {
    const index = mockData.todos.findIndex(t => t.id === id)
    if (index === -1) throw new Error('Todo not found')
    return mockData.todos.splice(index, 1)[0]
  },

  async listTodos() {
    return mockData.todos
  }
}

// Utility functions
export const dbUtils = {
  async healthCheck() {
    return { status: 'healthy', timestamp: new Date() }
  },

  async disconnect() {
    // Mock disconnect
  }
}

// Mock prisma export for compatibility
export const prisma = {
  $queryRaw: async () => [1],
  $disconnect: async () => {}
}