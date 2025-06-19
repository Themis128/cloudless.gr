import type { Project } from '~/types/project';

export const useFetchProjects = () => {
  const fetchProject = async (id: string): Promise<Project | null> => {
    try {
      const response = (await $fetch(`/api/projects/${id}`)) as { data: Project };
      return response.data;
    } catch (error) {
      console.error('Error fetching project:', error);
      return null;
    }
  };

  const fetchProjects = async (): Promise<Project[]> => {
    try {
      const response = (await $fetch('/api/projects')) as { data: Project[] };
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  };

  return {
    fetchProject,
    fetchProjects,
  };
};
