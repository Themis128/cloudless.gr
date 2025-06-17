/**
 * Project-related type definitions
 */

export interface Project {
  id: string
  owner_id: string
  name: string
  description?: string
  type: ProjectType
  status: ProjectStatus
  created_at: string
  updated_at: string
  
  // Related data
  pipelines?: Pipeline[]
  training_jobs?: TrainingJob[]
  model_versions?: ModelVersion[]
}

export type ProjectType = 
  | 'classification'
  | 'regression'
  | 'clustering'
  | 'nlp'
  | 'cv'
  | 'recommendation'
  | 'time-series'
  | 'custom'

export type ProjectStatus = 
  | 'draft'
  | 'active'
  | 'training'
  | 'deployed'
  | 'completed'
  | 'error'
  | 'archived'
  | 'paused'

export interface Pipeline {
  id: string
  project_id: string
  owner_id: string
  config: PipelineConfig
  created_at: string
  updated_at: string
}

export interface PipelineConfig {
  nodes: PipelineNode[]
  connections: PipelineConnection[]
  metadata?: Record<string, any>
}

export interface PipelineNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  config: Record<string, any>
  inputs?: NodePort[]
  outputs?: NodePort[]
}

export interface PipelineConnection {
  id: string
  source: string
  target: string
  sourcePort: string
  targetPort: string
}

export interface NodePort {
  id: string
  name: string
  type: 'input' | 'output'
  dataType: string
}

export type NodeType = 
  | 'data-loader'
  | 'preprocessing'
  | 'feature-engineering'
  | 'model'
  | 'training'
  | 'evaluation'
  | 'deployment'
  | 'visualization'
  | 'export'

export interface TrainingJob {
  id: string
  project_id: string
  owner_id: string
  status: TrainingStatus
  log_url?: string
  metrics?: Record<string, any>
  created_at: string
  updated_at: string
  completed_at?: string
}

export type TrainingStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ModelVersion {
  id: string
  project_id: string
  owner_id: string
  version_tag: string
  deployed: boolean
  endpoint_url?: string
  model_file_url?: string
  metrics?: Record<string, any>
  created_at: string
}

export interface CreateProjectData {
  name: string
  description?: string
  type: ProjectType
  template?: string
  config?: Partial<PipelineConfig>
}

export interface UpdateProjectData {
  name?: string
  description?: string
  status?: ProjectStatus
}
