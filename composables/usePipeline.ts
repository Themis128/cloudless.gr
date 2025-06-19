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

      // Fetch the project data from the API
      const response = await $fetch<{ data: Project }>(`/api/projects/${projectId}`);
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

      await $fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'PUT',
        body: { config },
      });

      if (project.value) {
        (project.value as any).config = { ...(project.value as any).config, pipeline: config };
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
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    };

    // Add to project config
    if ((project.value as any)?.config?.pipeline?.nodes) {
      (project.value as any).config.pipeline.nodes.push(newNode);
    }

    return newNode;
  };

  const removePipelineNode = (nodeId: string) => {
    if ((project.value as any)?.config?.pipeline) {
      // Remove node
      (project.value as any).config.pipeline.nodes = (
        project.value as any
      ).config.pipeline.nodes.filter((n: PipelineNode) => n.id !== nodeId);

      // Remove connections involving this node
      (project.value as any).config.pipeline.connections = (
        project.value as any
      ).config.pipeline.connections.filter(
        (c: PipelineConnection) => c.source !== nodeId && c.target !== nodeId,
      );
    }
  };

  const addConnection = (connection: Omit<PipelineConnection, 'id'>) => {
    const newConnection: PipelineConnection = {
      ...connection,
      id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    };

    if ((project.value as any)?.config?.pipeline?.connections) {
      (project.value as any).config.pipeline.connections.push(newConnection);
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
