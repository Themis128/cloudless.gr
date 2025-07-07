import { useSupabaseClient, useSupabaseUser } from '#imports';
import type { Database } from '~/types/supabase';
import type {
  AnalyticsPipeline,
  AnalyticsPipelineInsert,
  AnalyticsPipelineUpdate,
  DataSource,
  DataSourceInsert,
  PipelineExecution,
  PipelineExecutionInsert,
  PipelineStep,
  PipelineStepInsert,
  PipelineStepUpdate,
  PipelineWithSteps,
} from '~/types/analytics-pipeline';

// --- Mapping functions: frontend types -> Supabase types ---
type AnalyticsPipelinesInsert = Database['public']['Tables']['analytics_pipelines']['Insert'];
type AnalyticsPipelinesUpdate = Database['public']['Tables']['analytics_pipelines']['Update'];
type PipelineStepsInsert = Database['public']['Tables']['pipeline_steps']['Insert'];
type PipelineStepsUpdate = Database['public']['Tables']['pipeline_steps']['Update'];
type PipelineExecutionsInsert = Database['public']['Tables']['pipeline_executions']['Insert'];
type DataSourcesInsert = Database['public']['Tables']['data_sources']['Insert'];

function mapAnalyticsPipelineInsert(p: AnalyticsPipelineInsert, owner_id: string): AnalyticsPipelinesInsert {
  return {
    ...p,
    owner_id,
  };
}

function mapAnalyticsPipelineUpdate(p: AnalyticsPipelineUpdate): AnalyticsPipelinesUpdate {
  return {
    ...p,
  };
}

function mapPipelineStepInsert(s: PipelineStepInsert): PipelineStepsInsert {
  return {
    ...s,
  };
}

function mapPipelineStepUpdate(s: PipelineStepUpdate): PipelineStepsUpdate {
  return {
    ...s,
  };
}

function mapPipelineExecutionInsert(e: PipelineExecutionInsert): PipelineExecutionsInsert {
  return {
    ...e,
  };
}

function mapDataSourceInsert(d: DataSourceInsert, owner_id: string): DataSourcesInsert {
  // Map frontend 'type' to Supabase 'source_type'
  const { type, ...rest } = d;
  return {
    ...rest,
    source_type: type,
    owner_id,
  };
}

export function useAnalyticsPipeline() {
  const supabase = useSupabaseClient<Database>();
  const user = useSupabaseUser();

  // Analytics Pipelines
  const createPipeline = async (
    pipeline: AnalyticsPipelineInsert,
  ): Promise<AnalyticsPipeline | null> => {
    if (!user.value?.id) {
      console.error('User not authenticated');
      return null;
    }
    const insertPayload = mapAnalyticsPipelineInsert(pipeline, user.value.id);
    const { data, error } = await supabase
      .from('analytics_pipelines')
      .insert([insertPayload])
      .select()
      .single();
    if (error) {
      console.error('Error creating pipeline:', error);
      return null;
    }
    // Ensure project_id is always a string (never null) and nullable fields are string | undefined
    return data
      ? {
          ...data,
          project_id: data.project_id ?? '',
          description: data.description ?? undefined,
          status: (data.status as "draft" | "active" | "archived" | "failed") ?? "draft",
          updated_at: data.updated_at ?? '',
          version: data.version ?? '',
          created_at: data.created_at ?? '',
          config: (data.config === null ? {} : data.config) as Record<string, unknown>,
        }
      : null;
  };

  const getPipeline = async (id: string): Promise<AnalyticsPipeline | null> => {
    const { data, error } = await supabase
      .from('analytics_pipelines')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching pipeline:', error);
      return null;
    }

    return data
      ? {
          ...data,
          project_id: data.project_id ?? '',
          description: data.description ?? undefined,
          status: (data.status as "draft" | "active" | "archived" | "failed") ?? "draft",
          updated_at: data.updated_at ?? '',
          version: data.version ?? '',
          created_at: data.created_at ?? '',
          config: (data.config === null ? {} : data.config) as Record<string, unknown>,
        }
      : null;
  };

  const getPipelineWithSteps = async (id: string): Promise<PipelineWithSteps | null> => {
    const { data, error } = await supabase
      .from('analytics_pipelines')
      .select(
        `
        *,
        steps:pipeline_steps(*)
      `,
      )
      .eq('id', id)
      .order('position', { foreignTable: 'pipeline_steps' })
      .single();

    if (error) {
      console.error('Error fetching pipeline with steps:', error);
      return null;
    }

    return data as PipelineWithSteps;
  };

  const getUserPipelines = async (projectId?: string): Promise<AnalyticsPipeline[]> => {
    if (!user.value?.id) return [];
    let query = supabase
      .from('analytics_pipelines')
      .select('*')
      .eq('owner_id', user.value.id)
      .order('updated_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user pipelines:', error);
      return [];
    }

    return data
      ? data.map((pipeline) => ({
          ...pipeline,
          project_id: pipeline.project_id ?? '',
          description: pipeline.description ?? undefined,
          status: (pipeline.status as "draft" | "active" | "archived" | "failed") ?? "draft",
          updated_at: pipeline.updated_at ?? '',
          version: pipeline.version ?? '',
          created_at: pipeline.created_at ?? '',
          config: (pipeline.config === null ? {} : pipeline.config) as Record<string, unknown>,
        }))
      : [];
  };

  const updatePipeline = async (
    id: string,
    updates: AnalyticsPipelineUpdate,
  ): Promise<AnalyticsPipeline | null> => {
    const updatePayload = mapAnalyticsPipelineUpdate(updates);
    updatePayload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('analytics_pipelines')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error updating pipeline:', error);
      return null;
    }
    return data
      ? {
          ...data,
          project_id: data.project_id ?? '',
          description: data.description ?? undefined,
          status: (data.status as "draft" | "active" | "archived" | "failed") ?? "draft",
          updated_at: data.updated_at ?? '',
          version: data.version ?? '',
          created_at: data.created_at ?? '',
          config: (data.config === null ? {} : data.config) as Record<string, unknown>,
        }
      : null;
  };

  const deletePipeline = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('analytics_pipelines').delete().eq('id', id);

    if (error) {
      console.error('Error deleting pipeline:', error);
      return false;
    }

    return true;
  };

  // Pipeline Steps
  const createStep = async (step: PipelineStepInsert): Promise<PipelineStep | null> => {
    const stepPayload = mapPipelineStepInsert(step);
    const { data, error } = await supabase.from('pipeline_steps').insert([stepPayload]).select().single();
    if (error) {
      console.error('Error creating step:', error);
      return null;
    }
    return data
      ? {
          ...data,
          pipeline_id: data.pipeline_id ?? '',
          step_type: data.step_type as PipelineStep['step_type'],
          description: data.description ?? undefined,
          is_configured: data.is_configured ?? false,
          config: (data.config === null ? {} : data.config) as { [key: string]: unknown },
          created_at: data.created_at ?? '',
          updated_at: data.updated_at ?? '',
        }
      : null;
  };

  const updateStep = async (
    id: string,
    updates: PipelineStepUpdate,
  ): Promise<PipelineStep | null> => {
    const updateStepPayload = mapPipelineStepUpdate(updates);
    updateStepPayload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('pipeline_steps')
      .update(updateStepPayload)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Error updating step:', error);
      return null;
    }
    return data
      ? {
          ...data,
          pipeline_id: data.pipeline_id ?? '',
          step_type: data.step_type as PipelineStep['step_type'],
          description: data.description ?? undefined,
          is_configured: data.is_configured ?? false,
          config: (data.config === null ? {} : data.config) as { [key: string]: unknown },
          created_at: data.created_at ?? '',
          updated_at: data.updated_at ?? '',
        }
      : null;
  };

  const deleteStep = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('pipeline_steps').delete().eq('id', id);

    if (error) {
      console.error('Error deleting step:', error);
      return false;
    }

    return true;
  };

  const reorderSteps = async (
    pipelineId: string,
    stepOrders: Array<{ id: string; position: number }>,
  ): Promise<boolean> => {
    const updates = stepOrders.map(({ id, position }) => {
      const payload = mapPipelineStepUpdate({ position });
      return supabase.from('pipeline_steps').update(payload).eq('id', id);
    });
    try {
      await Promise.all(updates);
      return true;
    } catch (error) {
      console.error('Error reordering steps:', error);
      return false;
    }
  };

  // Pipeline Executions
  const executePipeline = async (pipelineId: string): Promise<PipelineExecution | null> => {
    const execution: PipelineExecutionInsert = {
      pipeline_id: pipelineId,
      status: 'pending',
      executed_by: user.value?.id || '',
      started_at: new Date().toISOString(),
    };
    const executionPayload = mapPipelineExecutionInsert(execution);
    const { data, error } = await supabase
      .from('pipeline_executions')
      .insert([executionPayload])
      .select()
      .single();
    if (error) {
      console.error('Error creating execution:', error);
      return null;
    }
    // In a real implementation, this would trigger the actual pipeline execution
    // For now, we'll just return the execution record
    return data
      ? {
          id: data.id,
          pipeline_id: data.pipeline_id ?? '',
          started_at: data.started_at ?? '',
          created_at: data.created_at ?? '',
          completed_at: data.completed_at ?? '',
          status: (data.status as PipelineExecution['status']) ?? 'pending',
          error_message: data.error_message ?? undefined,
          logs: data.logs ?? undefined,
          results: typeof data.results === 'object' && data.results !== null ? data.results as Record<string, unknown> : {},
          duration_seconds: data.duration_seconds === null ? undefined : data.duration_seconds,
          executed_by: data.executed_by,
        }
      : null;
  };

  const getExecutionHistory = async (pipelineId: string): Promise<PipelineExecution[]> => {
    const { data, error } = await supabase
      .from('pipeline_executions')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching execution history:', error);
      return [];
    }

    return data
      ? data.map((exec) => ({
          id: exec.id,
          pipeline_id: exec.pipeline_id ?? '',
          started_at: exec.started_at ?? '',
          created_at: exec.created_at ?? '',
          completed_at: exec.completed_at ?? '',
          status: (exec.status as PipelineExecution['status']) ?? 'pending',
          error_message: exec.error_message ?? undefined,
          logs: exec.logs ?? undefined,
          results: typeof exec.results === 'object' && exec.results !== null ? exec.results as Record<string, unknown> : {},
          duration_seconds: exec.duration_seconds === null ? undefined : exec.duration_seconds,
          executed_by: exec.executed_by,
        }))
      : [];
  };

  // Data Sources
  const createDataSource = async (dataSource: DataSourceInsert): Promise<DataSource | null> => {
    if (!user.value?.id) {
      console.error('User not authenticated');
      return null;
    }
    const dsPayload = mapDataSourceInsert(dataSource, user.value.id);
    const { data, error } = await supabase
      .from('data_sources')
      .insert([dsPayload])
      .select()
      .single();
    if (error) {
      console.error('Error creating data source:', error);
      return null;
    }
    return data
      ? {
          id: data.id,
          name: data.name,
          owner_id: data.owner_id,
          type: data.source_type as DataSource['type'],
          is_active: data.is_active ?? true,
          created_at: data.created_at ?? '',
          updated_at: data.updated_at ?? '',
          connection_config: typeof data.connection_config === 'object' && data.connection_config !== null ? data.connection_config as Record<string, unknown> : {},
        }
      : null;
  };

  const getUserDataSources = async (): Promise<DataSource[]> => {
    if (!user.value?.id) return [];
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('owner_id', user.value.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching data sources:', error);
      return [];
    }

    return data
      ? data.map((ds) => ({
          id: ds.id,
          name: ds.name,
          owner_id: ds.owner_id,
          type: ds.source_type as DataSource['type'],
          is_active: ds.is_active ?? true,
          created_at: ds.created_at ?? '',
          updated_at: ds.updated_at ?? '',
          connection_config: typeof ds.connection_config === 'object' && ds.connection_config !== null ? ds.connection_config as Record<string, unknown> : {},
        }))
      : [];
  };

  return {
    // Pipelines
    createPipeline,
    getPipeline,
    getPipelineWithSteps,
    getUserPipelines,
    updatePipeline,
    deletePipeline,

    // Steps
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,

    // Executions
    executePipeline,
    getExecutionHistory,

    // Data Sources
    createDataSource,
    getUserDataSources,
  };
}
// ...existing code...
