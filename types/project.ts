// Project type definitions for Cloudless.gr platform
// Synchronized with Supabase database schema

import type { Database } from './supabase-generated';

// Re-export the database types for convenience
export type Project = Database['public']['Tables']['projects']['Row'] & {
  model_versions?: ModelVersion[];
  training_sessions?: TrainingSession[];
  deployments?: Deployment[];
  // Add missing property for UI
  training_jobs?: TrainingSession[]; // alias for training_sessions
};

export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ModelVersion = Database['public']['Tables']['model_versions']['Row'] & {
  // Fix property name mismatch
  deployed?: boolean; // alias for is_deployed
  endpoint_url?: string | null; // add missing endpoint URL
};
export type ModelVersionInsert = Database['public']['Tables']['model_versions']['Insert'];
export type ModelVersionUpdate = Database['public']['Tables']['model_versions']['Update'];

export type TrainingSession = Database['public']['Tables']['training_sessions']['Row'] & {
  // Add utility properties for UI
  isActive?: boolean;
  currentEpoch?: number;
  totalEpochs?: number;
  progress?: number;
  endedAt?: string | null;
  log_url?: string | null;
};
export type TrainingSessionInsert = Database['public']['Tables']['training_sessions']['Insert'];
export type TrainingSessionUpdate = Database['public']['Tables']['training_sessions']['Update'];

export type Deployment = Database['public']['Tables']['deployments']['Row'] & {
  // Add utility properties for UI
  stoppedAt?: string | null;
  healthStatus?: 'healthy' | 'unhealthy';
  url?: string | null; // alias for endpoint_url
  instanceCount?: number;
  projectId?: string; // alias for project_id
  version?: string;
  createdAt?: Date | string;
  config?: DeploymentConfig;
  environment?: string;
  // environment is already in the Supabase type
};
export type DeploymentInsert = Database['public']['Tables']['deployments']['Insert'];
export type DeploymentUpdate = Database['public']['Tables']['deployments']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// Utility interfaces for forms and API calls
export interface CreateProjectData {
  name: string;
  description?: string | null;
  type?: Project['type'];
  framework?: string | null;
  environment?: string | null;
  enable_versioning?: boolean;
  enable_monitoring?: boolean;
  enable_auto_scaling?: boolean;
  enable_experiment_tracking?: boolean;
  tags?: string;
  config?: any;
  owner_id?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  features: string[];
  technologies?: string[]; // alias for techStack
  techStack: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  includes: string[];
  pipelineImage?: string;
  config?: {
    type?: string;
    framework?: string;
    [key: string]: any;
  };
}

export interface TrainingConfig {
  algorithm: string;
  parameters: Record<string, any>;
  epochs?: number;
  batch_size?: number; // Add batch_size property
  learningRate?: number;
  validationSplit?: number;
  earlyStoppingPatience?: number;
  optimizerType?: string;
  lossFunction?: string;
  metrics?: string[];
  regularization?: Record<string, any>;
  dataAugmentation?: boolean;
  dataset_config: {
    source: string;
    features: string[];
    target: string;
    split_ratio?: number;
  };
  validation: {
    method: 'holdout' | 'cross_validation' | 'time_series';
    parameters: Record<string, any>;
  };
}

export interface TrainingMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  mse?: number;
  rmse?: number;
  mae?: number;
  r2_score?: number;
  loss_history?: number[];
  loss?: number;
  valLoss?: number;
  validation_metrics?: Record<string, number>;
  training_time?: number;
  epochs?: number;
  epoch?: number; // Add epoch property
  dataAugmentation?: boolean; // Add missing property
  overfitting_detected?: boolean; // Add missing property
}

export interface DeploymentConfig {
  instance_type: string;
  environment?: 'development' | 'staging' | 'production';
  autoScaling?: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCpuUtilization: number;
  };
  scaling?: {
    min_instances: number;
    max_instances: number;
    auto_scaling: boolean;
  };
  healthCheck?: {
    enabled: boolean;
    path: string;
    intervalSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
  };
  resources?: {
    cpu: string;
    memory: string;
    storage: string;
  };
  environment_variables?: Record<string, string>;
  environmentVariables?: Record<string, string>;
  secrets?: Record<string, string>;
  resource_limits?: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

export interface ApiEndpoint {
  id: string;
  deployment_id: string;
  url: string;
  path?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  auth_required?: boolean;
  authenticated?: boolean;
  rate_limit?: number | null;
  rateLimit?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceMetrics {
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  throughput: number;
  error_rate: number;
  uptime: number;
  last_updated: string;
}

export interface PipelineConfig {
  version?: string;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
  global_config: Record<string, any>;
  metadata?: any; // Add back metadata property
}

export interface PipelineNode {
  id: string;
  type: 'data_source' | 'transform' | 'model' | 'output';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
  inputs?: string[]; // Add back inputs property
}

export interface PipelineConnection {
  id: string;
  source: string;
  target: string;
  config?: Record<string, any>;
}

// Helper interfaces for API compatibility
export interface CreateTrainingSessionData {
  project_id: string; // Use correct property name
  name: string;
  config: any;
  status?: TrainingStatus;
}

export interface CreateDeploymentData {
  project_id: string; // Use correct property name
  model_version_id: string;
  name: string;
  environment?: 'development' | 'staging' | 'production';
  config: Record<string, any>;
}

// Helper functions for property mapping
export const mapModelVersion = (version: ModelVersion): ModelVersion => ({
  ...version,
  deployed: version.is_deployed ?? false, // Map is_deployed to deployed
});

export const mapDeployment = (deployment: Deployment): Deployment => ({
  ...deployment,
  url: deployment.endpoint_url, // Map endpoint_url to url
});

export const mapProfile = (profile: Profile): Profile => ({
  ...profile,
  // role field already exists in profile, no need to map is_admin
});

export const mapProject = (project: Project): Project => ({
  ...project,
  training_jobs: project.training_sessions, // Map training_sessions to training_jobs
});

// Utility types
export type ProjectStatus = Project['status'];
export type ProjectType = Project['type'];
export type TrainingStatus = TrainingSession['status'];
export type DeploymentStatus = Deployment['status'];
