// Analytics Pipeline Types
// Generated from Supabase schema for analytics pipeline functionality

export interface AnalyticsPipeline {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  version: string;
  config: Record<string, any>;
  status: 'draft' | 'active' | 'archived' | 'failed';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStep {
  id: string;
  pipeline_id: string;
  step_type: 'DataInput' | 'DataValidation' | 'SmartProcessing' | 'MLAnalytics' | 'Visualization' | 'ReportGeneration';
  name: string;
  description?: string;
  position: number;
  config: Record<string, any>;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineExecution {
  id: string;
  pipeline_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  logs?: string;
  error_message?: string;
  results?: Record<string, any>;
  executed_by: string;
  created_at: string;
}

export interface PipelineStepExecution {
  id: string;
  execution_id: string;
  step_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  logs?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'file' | 'database' | 'api' | 'cloud';
  connection_config: Record<string, any>;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValidationRule {
  id: string;
  pipeline_id: string;
  step_id?: string;
  rule_type: 'required' | 'type_check' | 'range' | 'pattern' | 'custom';
  field_name?: string;
  rule_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Insert/Update Types
export type AnalyticsPipelineInsert = Omit<AnalyticsPipeline, 'id' | 'created_at' | 'updated_at'>;
export type AnalyticsPipelineUpdate = Partial<Omit<AnalyticsPipeline, 'id' | 'created_at' | 'updated_at'>>;

export type PipelineStepInsert = Omit<PipelineStep, 'id' | 'created_at' | 'updated_at'>;
export type PipelineStepUpdate = Partial<Omit<PipelineStep, 'id' | 'created_at' | 'updated_at'>>;

export type PipelineExecutionInsert = Omit<PipelineExecution, 'id' | 'created_at'>;
export type PipelineExecutionUpdate = Partial<Omit<PipelineExecution, 'id' | 'created_at'>>;

export type DataSourceInsert = Omit<DataSource, 'id' | 'created_at' | 'updated_at'>;
export type DataSourceUpdate = Partial<Omit<DataSource, 'id' | 'created_at' | 'updated_at'>>;

export type ValidationRuleInsert = Omit<ValidationRule, 'id' | 'created_at' | 'updated_at'>;
export type ValidationRuleUpdate = Partial<Omit<ValidationRule, 'id' | 'created_at' | 'updated_at'>>;

// Combined types for frontend use
export interface PipelineWithSteps extends AnalyticsPipeline {
  steps: PipelineStep[];
}

export interface ExecutionWithSteps extends PipelineExecution {
  step_executions: PipelineStepExecution[];
}

export interface StepWithValidations extends PipelineStep {
  validation_rules: ValidationRule[];
}
