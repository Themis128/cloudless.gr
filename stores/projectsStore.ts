import { defineStore } from 'pinia';
import { readonly, ref } from 'vue';

import { useSupabaseDB } from '~/composables/useSupabaseDB';
import type { Project, TrainingSession, Deployment } from '~/types/supabase.d';

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
  function getProjectById(id: string): Project | undefined {
    return projects.value.find((p) => p.id === id);
  }

  function getProjectsByStatus(status: Project['status']): Project[] {
    return projects.value.filter((p) => p.status === status);
  }

  function activeProjects(): Project[] {
    return projects.value.filter((p) => p.status === 'active');
  }

  function completedProjects(): Project[] {
    return projects.value.filter((p) => p.status === 'completed');
  }

  function getTrainingSessionsForProject(projectId: string): TrainingSession[] {
    return trainingSessions.value.filter((s) => s.project_id === projectId);
  }

  function getDeploymentsForProject(projectId: string): Deployment[] {
    return deployments.value.filter((d) => d.project_id === projectId);
  }

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
    config?: Project['config'];
  }) {
    loading.value = true;
    error.value = null;

    try {
      const data = await projectsAPI.create({
        name: projectData.name,
        description: projectData.description ?? null,
        type: projectData.type,
        status: projectData.status ?? 'draft',
        config: typeof projectData.config === 'object' && projectData.config !== null ? projectData.config : {},
      });

      if (data) {
        const newProjects: Project[] = [data as Project, ...projects.value as Project[]];
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
      config?: TrainingSession['config'];
    },
  ) {
    loading.value = true;
    error.value = null;

    try {
      const safeUpdates = {
        ...updates,
        config: typeof updates.config === 'object' && updates.config !== null ? updates.config : {},
      };
      const data = await projectsAPI.update(id, safeUpdates);

      if (data) {
        const index = projects.value.findIndex((p) => p.id === id);
        if (index !== -1) {
          projects.value[index] = data as Project;
        }

        if (currentProject.value?.id === id) {
          currentProject.value = data as Project;
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
      config: TrainingSession['config'];
      pipeline_id?: string;
    },
  ) {
    loading.value = true;
    error.value = null;

    try {
      const data = await trainingAPI.create({
        project_id: projectId,
        name: sessionData.name,
        config: typeof sessionData.config === 'object' && sessionData.config !== null ? sessionData.config : {},
        pipeline_id: sessionData.pipeline_id,
      });

      if (data) {
        trainingSessions.value.unshift(data as TrainingSession);
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
          trainingSessions.value[index] = data as TrainingSession;
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
    config: Deployment['config'];
  }) {
    loading.value = true;
    error.value = null;

    try {
      const data = await deploymentsAPI.create({
        project_id: deploymentData.project_id,
        model_version_id: deploymentData.model_version_id,
        name: deploymentData.name,
        environment: deploymentData.environment ?? 'development',
        config: typeof deploymentData.config === 'object' && deploymentData.config !== null ? deploymentData.config : {},
      });

      if (data) {
        deployments.value.unshift(data as Deployment);
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
          deployments.value[index] = data as Deployment;
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
          deployments.value[index] = data as Deployment;
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
