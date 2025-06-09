// composable to fetch and manage project data
import { computed, ref } from 'vue';
import type { Project, ProjectCategory, ProjectFilter, ProjectStatus } from '~/types/projects';

export function useProjects() {
  const projects = ref<Project[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const featuredProjects = computed(() => {
    return projects.value.filter((project) => project.featured);
  });

  const recentProjects = computed(() => {
    return [...projects.value]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  });

  async function fetchProjects(filter?: ProjectFilter): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // In a real application, this would call your API
      // For now, we'll simulate an API call with a timeout
      const { data } = await useFetch('/api/projects', {
        query: filter,
      });

      if (data.value) {
        projects.value = data.value as Project[];
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      error.value = 'Failed to load projects. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchProjectBySlug(slug: string): Promise<Project | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await useFetch(`/api/projects/${slug}`);
      return data.value as Project;
    } catch (err) {
      console.error(`Error fetching project with slug ${slug}:`, err);
      error.value = 'Failed to load project details. Please try again.';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleFavorite(id: number): Promise<void> {
    try {
      // Find the project in our local state
      const project = projects.value.find((p) => p.id === id);
      if (!project) return;

      // Toggle favorite status locally first for immediate feedback
      project.isFavorite = !project.isFavorite;

      // Update on the server
      await useFetch(`/api/projects/${id}/favorite`, {
        method: 'POST',
        body: { isFavorite: project.isFavorite },
      });
    } catch (err) {
      console.error('Error toggling favorite status:', err);
      error.value = 'Failed to update favorite status. Please try again.';

      // Revert the local change if the server update failed
      const project = projects.value.find((p) => p.id === id);
      if (project) {
        project.isFavorite = !project.isFavorite;
      }
    }
  }

  function getRelatedProjects(project: Project): Project[] {
    if (!project.relatedProjects?.length) {
      // If no related projects specified, find projects with similar tags or category
      return projects.value
        .filter(
          (p) =>
            p.id !== project.id &&
            (p.category === project.category ||
              p.tech_tags.some((tag) =>
                project.tech_tags.map((t) => t.tag_name).includes(tag.tag_name)
              ))
        )
        .slice(0, 3);
    }

    // Return projects based on the relatedProjects IDs
    return projects.value.filter((p) => project.relatedProjects?.includes(p.id)).slice(0, 3);
  }

  function filterByCategory(category: ProjectCategory): Project[] {
    return projects.value.filter((project) => project.category === category);
  }

  function filterByStatus(status: ProjectStatus): Project[] {
    return projects.value.filter((project) => project.status === status);
  }

  function searchProjects(query: string): Project[] {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return projects.value;

    return projects.value.filter(
      (project) =>
        project.project_name.toLowerCase().includes(searchTerm) ||
        project.description.toLowerCase().includes(searchTerm) ||
        project.overview.toLowerCase().includes(searchTerm) ||
        project.tech_tags.some((tag) => tag.tag_name.toLowerCase().includes(searchTerm))
    );
  }

  // Fetch projects on initialization
  onMounted(() => {
    fetchProjects();
  });

  return {
    projects,
    featuredProjects,
    recentProjects,
    isLoading,
    error,
    fetchProjects,
    fetchProjectBySlug,
    toggleFavorite,
    getRelatedProjects,
    filterByCategory,
    filterByStatus,
    searchProjects,
  };
}
