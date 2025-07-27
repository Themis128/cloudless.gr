// API Types for the application
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface Dataset {
  id: string
  name: string
  description?: string
  type: string
  status: string
  size: number
  format: string
  samples?: number
  filePath?: string
  userId?: number
  createdAt: Date
  updatedAt: Date
}

export interface LLMForm {
  name: string
  description: string
  type: string
  config: string
  hyperparameters?: string
}

export interface PipelineResponse {
  id: string
  name: string
  description?: string
  type: string
  status: string
  config?: string
  createdAt: Date
  updatedAt: Date
  userId: number
}

export interface BotResponse {
  id: string
  name: string
  description?: string
  type: string
  status: string
  config?: string
  createdAt: Date
  updatedAt: Date
  userId: number
}

export interface ModelResponse {
  id: string
  name: string
  description?: string
  type: string
  status: string
  config?: string
  createdAt: Date
  updatedAt: Date
  userId: number
}

export interface TrainingSession {
  id: string
  modelId: string
  status: string
  progress: number
  createdAt: Date
  updatedAt: Date
}

export interface BotDeployment {
  id: string
  botId: string
  status: string
  url?: string
  createdAt: Date
  updatedAt: Date
  bot?: BotResponse
} 