import { defineStore } from 'pinia';
import { computed, readonly, ref } from 'vue';
import type { Deployment, Project, TrainingSession } from '~/types/supabase.d';

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const trainingSessions = ref<TrainingSession[]>([]);
  const deployments = ref<Deployment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Get the Supabase composable
  const {
    projects: projectsAPI,
    trainingSessions: trainingAPI,
    deployments: deploymentsAPI,
  } = useSupabaseDB();

  // Getters
  const getProjectById = computed(() => {
    return (id: string) => projects.value.find((p: any) => p.id === id);
  });

  const getProjectsByStatus = computed(() => {
    return (status: any) => projects.value.filter((p: any) => p.status === status);
  });

  const activeProjects = computed(() => {
    // Using explicit typing to avoid infinite recursion
    const allProjects: any[] = projects.value;
    return allProjects.filter((p: any) => p.status === 'active');
  });

  const completedProjects = computed(() => {
    // Using explicit typing to avoid infinite recursion
    const allProjects: any[] = projects.value;
    return allProjects.filter((p: any) => p.status === 'completed');
  });

  const getTrainingSessionsForProject = computed(() => {
    return (projectId: string) =>
      trainingSessions.value.filter((s: any) => s.project_id === projectId);
  });

  const getDeploymentsForProject = computed(() => {
    return (projectId: string) => deployments.value.filter((d: any) => d.project_id === projectId);
  });

  // Actions
  async function fetchProjects() {
    loading.value = true;
    error.value = null;

    try {
      const data = await projectsAPI.getAll();
      projects.value = data || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch projects';
      console.error('Error fetching projects:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchProject(id: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await projectsAPI.getById(id);
      currentProject.value = data || null;
      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch project';
      console.error('Error fetching project:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function createProject(projectData: {
    name: string;
    description?: string;
    type: Project['type'];
    status?: Project['status'];
    config?: any;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const data = await projectsAPI.create({
        name: projectData.name,
        description: projectData.description ?? null,
        type: projectData.type,
        status: projectData.status ?? 'draft',
        config: projectData.config ?? {},
      });

      if (data) {
        const newProjects = [data as any, ...projects.value];
        projects.value = newProjects;
      }
      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create project';
      console.error('Error creating project:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProject(
    id: string,
    updates: {
      name?: string;
      description?: string;
      type?: Project['type'];
      status?: Project['status'];
      config?: any;
    },
  ) {
    loading.value = true;
    error.value = null;

    try {
      const data = await projectsAPI.update(id, updates);

      if (data) {
        const index = projects.value.findIndex((p) => p.id === id);
        if (index !== -1) {
          projects.value[index] = data as any;
        }

        if (currentProject.value?.id === id) {
          currentProject.value = data as any;
        }
      }

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update project';
      console.error('Error updating project:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteProject(id: string) {
    loading.value = true;
    error.value = null;

    try {
      await projectsAPI.delete(id);

      const index = projects.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        projects.value.splice(index, 1);
      }

      if (currentProject.value?.id === id) {
        currentProject.value = null;
      }

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete project';
      console.error('Error deleting project:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Training Sessions
  async function fetchTrainingSessions(projectId: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await trainingAPI.getByProject(projectId);
      trainingSessions.value = data || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch training sessions';
      console.error('Error fetching training sessions:', err);
    } finally {
      loading.value = false;
    }
  }

  async function startTraining(
    projectId: string,
    sessionData: {
      name: string;
      config: Record<string, any>;
      pipeline_id?: string;
    },
  ) {
    loading.value = true;
    error.value = null;

    try {
      const data = await trainingAPI.create({
        project_id: projectId,
        ...sessionData,
      });

      if (data) {
        trainingSessions.value.unshift(data as any);
      }
      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start training';
      console.error('Error starting training:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function stopTraining(sessionId: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await trainingAPI.stop(sessionId);

      if (data) {
        const index = trainingSessions.value.findIndex((s) => s.id === sessionId);
        if (index !== -1) {
          trainingSessions.value[index] = data as any;
        }
      }

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop training';
      console.error('Error stopping training:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Deployments
  async function fetchDeployments(projectId: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await deploymentsAPI.getByProject(projectId);
      deployments.value = data || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch deployments';
      console.error('Error fetching deployments:', err);
    } finally {
      loading.value = false;
    }
  }

  async function createDeployment(deploymentData: {
    project_id: string;
    model_version_id: string;
    name: string;
    environment?: 'development' | 'staging' | 'production';
    config: Record<string, any>;
  }) {
    loading.value = true;
    error.value = null;

    try {
      const data = await deploymentsAPI.create({
        ...deploymentData,
        environment: deploymentData.environment ?? 'development',
      });

      if (data) {
        deployments.value.unshift(data as any);
      }
      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create deployment';
      console.error('Error creating deployment:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function startDeployment(deploymentId: string, endpointUrl?: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await deploymentsAPI.deploy(deploymentId, endpointUrl);

      if (data) {
        const index = deployments.value.findIndex((d) => d.id === deploymentId);
        if (index !== -1) {
          deployments.value[index] = data as any;
        }
      }

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start deployment';
      console.error('Error starting deployment:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function stopDeployment(deploymentId: string) {
    loading.value = true;
    error.value = null;

    try {
      const data = await deploymentsAPI.stop(deploymentId);

      if (data) {
        const index = deployments.value.findIndex((d) => d.id === deploymentId);
        if (index !== -1) {
          deployments.value[index] = data as any;
        }
      }

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to stop deployment';
      console.error('Error stopping deployment:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Utilities
  function clearError() {
    error.value = null;
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project;
  }

  return {
    // State
    projects: readonly(projects),
    currentProject: readonly(currentProject),
    trainingSessions: readonly(trainingSessions),
    deployments: readonly(deployments),
    loading: readonly(loading),
    error: readonly(error),

    // Getters
    getProjectById,
    getProjectsByStatus,
    activeProjects,
    completedProjects,
    getTrainingSessionsForProject,
    getDeploymentsForProject,

    // Actions
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    fetchTrainingSessions,
    startTraining,
    stopTraining,
    fetchDeployments,
    createDeployment,
    startDeployment,
    stopDeployment,
    clearError,
    setCurrentProject,
  };
});
