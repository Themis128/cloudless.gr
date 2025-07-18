import type { Json } from './database.types'

export interface PipelineDetails {
  name: string
  description: string
  type: string
  isActive: boolean
}

export interface ModelParams {
  temperature: number
  maxTokens: number
  outputFormat: string
}

export interface CustomModel {
  name: string
  endpoint: string
  type: string
  apiKey: string
}

export interface ModelConfig {
  type: 'predefined' | 'custom'
  modelId?: string
  customModel?: CustomModel
  params: ModelParams
}

export interface SourceConfig {
  type: 'text' | 'file' | 'api' | 'database' | 'stream' | 'csv' | 'sensor'
  // Text source config
  text?: {
    content: string
    encoding?: string
  }
  // File source config
  file?: {
    allowedTypes: string[]
    maxSize: number
    concurrent: number
  }
  // CSV source config
  csv?: {
    delimiter: string
    hasHeader: boolean
    columns?: string[]
    skipRows?: number
    encoding?: string
    trimFields?: boolean
    skipEmptyLines?: boolean
    commentChar?: string
    chunkSize?: number
  }
  // Sensor source config
  sensor?: {
    type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light' | 'custom'
    protocol: 'mqtt' | 'http' | 'websocket' | 'modbus' | 'serial'
    deviceId: string
    interval: number // polling interval in milliseconds
    unit?: string // e.g., 'celsius', 'fahrenheit', 'percent', 'hPa'
    range?: {
      min: number
      max: number
    }
    connection: {
      address: string // IP address, URL, or port
      credentials?: {
        username?: string
        password?: string
        apiKey?: string
      }
      settings?: {
        baudRate?: number // for serial connections
        timeout?: number
        retries?: number
        qos?: 0 | 1 | 2 // for MQTT
        topic?: string // for MQTT
      }
    }
    preprocessing?: {
      averaging?: boolean // enable rolling average
      windowSize?: number // size of averaging window
      calibration?: {
        offset: number
        scale: number
      }
      thresholds?: {
        low: number
        high: number
      }
      filters?: {
        outliers?: boolean // remove statistical outliers
        smoothing?: boolean // apply smoothing filter
      }
    }
  }
  // API source config
  api?: {
    endpoint: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers: Record<string, string>
    body?: any
    authentication?: {
      type: 'bearer' | 'basic' | 'api_key'
      token?: string
      username?: string
      password?: string
      key?: string
    }
  }
  // Database source config
  database?: {
    type: 'postgres' | 'mysql' | 'mongodb'
    connection: string
    query: string
    params?: Record<string, any>
  }
  // Stream source config
  stream?: {
    type: 'websocket' | 'sse' | 'kafka'
    endpoint: string
    topics?: string[]
    batchSize?: number
  }
}

export interface PreprocessingOptions {
  cleanText: boolean
  removeStopwords: boolean
  lowercase: boolean
  trim: boolean
  normalizeWhitespace: boolean
  removeSpecialChars: boolean
  customReplacements?: Array<{
    pattern: string
    replacement: string
  }>
  tokenization?: {
    enabled: boolean
    method: 'word' | 'sentence' | 'character'
    customSeparator?: string
  }
  encoding?: {
    type: 'utf8' | 'ascii' | 'base64'
    handleErrors: 'skip' | 'replace' | 'strict'
  }
}

export interface ValidationRules {
  required: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  custom?: Array<{
    name: string
    validator: string // JavaScript function as string
    errorMessage: string
  }>
  dataType?: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    format?: string // e.g., 'email', 'date', 'url'
  }
  range?: {
    min?: number
    max?: number
  }
}

export interface AdvancedSettings {
  performance: {
    caching: boolean
    cacheTTL: number
    batchSize: number
    timeout: number
    retryAttempts: number
    retryDelay: number
  }
  errorHandling: {
    continueOnError: boolean
    logErrors: boolean
    errorThreshold: number
    fallbackValue?: any
  }
  monitoring: {
    collectMetrics: boolean
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    sampleRate: number
  }
}

export interface InputProcessorConfig {
  source: SourceConfig
  preprocessing: PreprocessingOptions
  validation: ValidationRules
  advanced: AdvancedSettings
}

export interface PipelineStep {
  id: number
  name: string
  type: PipelineStepType
  config: InputProcessorConfig | string // Use union type to maintain backward compatibility
}

export type PipelineStepType = 'input_processor' | 'llm_processor' | 'output_processor' | 'data_transformer' | 'validator'

export interface Pipeline {
  id?: string
  name: string
  description: string | null
  type: string
  is_active: boolean
  owner_id: string
  project_id?: string
  config: Json
  created_at?: string
  updated_at?: string | null
  version?: number | null
}

export interface Model {
  id: string
  name: string
  created_at?: string | null
}

