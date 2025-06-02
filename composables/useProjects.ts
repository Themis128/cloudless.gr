// composable to fetch and manage project data
import { computed, onMounted, readonly, ref, useFetch } from '#imports';
import type {
    Project,
    ProjectCategory,
    ProjectFilter,
    ProjectStatus,
    UseProjectsComposable,
} from '~/types/projects';

export function useProjects(): UseProjectsComposable {
  const projects = ref<Project[]>([]);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const lastFetch = ref<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const featuredProjects = computed(() =>
    projects.value.filter((project: Project) => project.featured)
  );

  const clearError = () => {
    error.value = null;
  };

  const fetchProjects = async (filter?: ProjectFilter): Promise<void> => {
    // Return cached data if it's fresh enough
    if (!filter && Date.now() - lastFetch.value < CACHE_DURATION) {
      return;
    }

    isLoading.value = true;
    clearError();

    try {
      const { data, error: fetchError } = await useFetch<Project[]>('/api/projects', {
        query: filter,
      });

      if (fetchError.value) {
        throw new Error(fetchError.value.message);
      }

      if (!data.value) {
        throw new Error('No data received from server');
      }

      projects.value = data.value;
      lastFetch.value = Date.now();
    } catch (err) {
      console.error('Error fetching projects:', err);
      error.value =
        err instanceof Error ? err.message : 'Failed to load projects. Please try again.';
    } finally {
      isLoading.value = false;
    }
  };

  const fetchProjectBySlug = async (slug: string): Promise<Project | null> => {
    if (!slug) {
      error.value = 'Project slug is required';
      return null;
    }

    isLoading.value = true;
    clearError();

    try {
      const { data, error: fetchError } = await useFetch<Project>(`/api/projects/${slug}`);

      if (fetchError.value) {
        throw new Error(fetchError.value.message);
      }

      if (!data.value) {
        throw new Error(`Project with slug "${slug}" not found`);
      }

      return data.value;
    } catch (err) {
      console.error(`Error fetching project with slug ${slug}:`, err);
      error.value =
        err instanceof Error ? err.message : 'Failed to load project details. Please try again.';
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  const toggleFavorite = async (id: number): Promise<void> => {
    if (!id) {
      error.value = 'Project ID is required';
      return;
    }

    const project = projects.value.find((p: Project) => p.id === id);
    if (!project) {
      error.value = 'Project not found';
      return;
    }

    const originalState = project.isFavorite;

    try {
      // Optimistic update
      project.isFavorite = !project.isFavorite;

      const { error: fetchError } = await useFetch(`/api/projects/${id}/favorite`, {
        method: 'POST',
        body: { isFavorite: project.isFavorite },
      });

      if (fetchError.value) {
        throw new Error(fetchError.value.message);
      }
    } catch (err) {
      // Revert on failure
      project.isFavorite = originalState;
      error.value =
        err instanceof Error ? err.message : 'Failed to update favorite status. Please try again.';
    }
  };

  const getRelatedProjects = (project: Project): Project[] => {
    if (!project) return [];

    if (project.relatedProjects?.length) {
      return projects.value
        .filter((p: Project) => project.relatedProjects?.includes(p.id))
        .slice(0, 3);
    }

    // Find projects with similar tags or category
    return projects.value
      .filter(
        (p: Project) =>
          p.id !== project.id &&
          (p.category === project.category ||
            p.tech_tags.some((tag) =>
              project.tech_tags.map((t) => t.tag_name).includes(tag.tag_name)
            ))
      )
      .slice(0, 3);
  };

  const filterByCategory = (category: ProjectCategory): Project[] => {
    if (!category) return projects.value;
    return projects.value.filter((project: Project) => project.category === category);
  };

  const filterByStatus = (status: ProjectStatus): Project[] => {
    if (!status) return projects.value;
    return projects.value.filter((project: Project) => project.status === status);
  };

  const searchProjects = (query: string): Project[] => {
    if (!query) return projects.value;

    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return projects.value;

    return projects.value.filter(
      (project: Project) =>
        project.project_name.toLowerCase().includes(searchTerm) ||
        project.description.toLowerCase().includes(searchTerm) ||
        project.overview.toLowerCase().includes(searchTerm) ||
        project.tech_tags.some((tag) => tag.tag_name.toLowerCase().includes(searchTerm))
    );
  };

  // Initialize projects on mount
  onMounted(async () => {
    try {
      await fetchProjects();
    } catch (err) {
      console.error('Failed to load initial projects:', err);
    }
  });

  return {
    projects: readonly(projects),
    featuredProjects,
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchProjects,
    fetchProjectBySlug,
    toggleFavorite,
    getRelatedProjects,
    filterByCategory,
    filterByStatus,
    searchProjects,
    clearError,
  };
}
