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

export const useAnalyticsPipeline = () => {
  const supabase = useSupabaseClient<any>();
  const user = useSupabaseUser();

  // Analytics Pipelines
  const createPipeline = async (
    pipeline: AnalyticsPipelineInsert,
  ): Promise<AnalyticsPipeline | null> => {
    if (!user.value?.id) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('analytics_pipelines')
      .insert({ ...pipeline, owner_id: user.value.id } as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating pipeline:', error);
      return null;
    }

    return data;
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

    return data;
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
    let query = supabase
      .from('analytics_pipelines')
      .select('*')
      .eq('owner_id', user.value?.id)
      .order('updated_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user pipelines:', error);
      return [];
    }

    return data || [];
  };

  const updatePipeline = async (
    id: string,
    updates: AnalyticsPipelineUpdate,
  ): Promise<AnalyticsPipeline | null> => {
    const { data, error } = await supabase
      .from('analytics_pipelines')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating pipeline:', error);
      return null;
    }

    return data;
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
    const { data, error } = await supabase.from('pipeline_steps').insert(step).select().single();

    if (error) {
      console.error('Error creating step:', error);
      return null;
    }

    return data;
  };

  const updateStep = async (
    id: string,
    updates: PipelineStepUpdate,
  ): Promise<PipelineStep | null> => {
    const { data, error } = await supabase
      .from('pipeline_steps')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating step:', error);
      return null;
    }

    return data;
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
    const updates = stepOrders.map(({ id, position }) =>
      supabase.from('pipeline_steps').update({ position }).eq('id', id),
    );

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

    const { data, error } = await supabase
      .from('pipeline_executions')
      .insert(execution)
      .select()
      .single();

    if (error) {
      console.error('Error creating execution:', error);
      return null;
    }

    // In a real implementation, this would trigger the actual pipeline execution
    // For now, we'll just return the execution record
    return data;
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

    return data || [];
  };

  // Data Sources
  const createDataSource = async (dataSource: DataSourceInsert): Promise<DataSource | null> => {
    const { data, error } = await supabase
      .from('data_sources')
      .insert({ ...dataSource, owner_id: user.value?.id })
      .select()
      .single();

    if (error) {
      console.error('Error creating data source:', error);
      return null;
    }

    return data;
  };

  const getUserDataSources = async (): Promise<DataSource[]> => {
    const { data, error } = await supabase
      .from('data_sources')
      .select('*')
      .eq('owner_id', user.value?.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching data sources:', error);
      return [];
    }

    return data || [];
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
};
