// usePipeline composable for pipeline management
import type { PipelineConfig, PipelineConnection, PipelineNode, Project } from '~/types/project';

export const usePipeline = (projectId: string) => {
  const project = ref<Project | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchProject = async () => {
    try {
      loading.value = true;
      error.value = null;

      // TODO: Replace with actual API call
      const response = (await $fetch(`/api/projects/${projectId}`)) as { data: Project };
      project.value = response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch project';
      console.error('Error fetching project:', err);
    } finally {
      loading.value = false;
    }
  };

  const updatePipelineConfig = async (config: PipelineConfig) => {
    try {
      loading.value = true;

      // TODO: Replace with actual API call
      await $fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'PUT',
        body: { config },
      });

      if (project.value) {
        project.value.config = { ...project.value.config, pipeline: config };
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update pipeline';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const addPipelineNode = (node: Omit<PipelineNode, 'id'>) => {
    const newNode: PipelineNode = {
      ...node,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add to project config
    if (project.value?.config?.pipeline?.nodes) {
      project.value.config.pipeline.nodes.push(newNode);
    }

    return newNode;
  };

  const removePipelineNode = (nodeId: string) => {
    if (project.value?.config?.pipeline) {
      // Remove node
      project.value.config.pipeline.nodes = project.value.config.pipeline.nodes.filter(
        (n: PipelineNode) => n.id !== nodeId,
      );

      // Remove connections involving this node
      project.value.config.pipeline.connections = project.value.config.pipeline.connections.filter(
        (c: PipelineConnection) => c.source !== nodeId && c.target !== nodeId,
      );
    }
  };

  const addConnection = (connection: Omit<PipelineConnection, 'id'>) => {
    const newConnection: PipelineConnection = {
      ...connection,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    if (project.value?.config?.pipeline?.connections) {
      project.value.config.pipeline.connections.push(newConnection);
    }

    return newConnection;
  };

  return {
    project: readonly(project),
    loading: readonly(loading),
    error: readonly(error),
    fetchProject,
    updatePipelineConfig,
    addPipelineNode,
    removePipelineNode,
    addConnection,
  };
};
