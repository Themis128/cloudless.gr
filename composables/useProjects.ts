// Composable to fetch and manage project data
import { computed, onMounted, ref } from 'vue';

export interface ProjectFilter {
  status?: string;
  type?: string;
  search?: string;
}

// Simple project interface to avoid type recursion
export interface SimpleProject {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
}

export function useProjects() {
  const projects = ref<SimpleProject[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Use the projects store (we'll mock it for now)
  const fetchProjectsFromStore = async () => {
    // Mock data for now
    return [
      {
        id: '1',
        name: 'AI Image Classifier',
        description: 'Computer vision model for image classification',
        status: 'active',
        type: 'cv',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_id: 'user_123',
      },
      {
        id: '2',
        name: 'Sentiment Analysis Bot',
        description: 'NLP model for sentiment analysis',
        status: 'draft',
        type: 'nlp',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        owner_id: 'user_123',
      },
    ] as SimpleProject[];
  };

  const featuredProjects = computed(() => {
    return projects.value.filter((project: SimpleProject) => project.status === 'active');
  });

  const recentProjects = computed(() => {
    return [...projects.value]
      .sort(
        (a: SimpleProject, b: SimpleProject) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      )
      .slice(0, 4);
  });

  async function fetchProjects(_filter?: ProjectFilter): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Use our mock data function
      const mockProjects = await fetchProjectsFromStore();
      projects.value = mockProjects;
    } catch (err) {
      console.error('Error fetching projects:', err);
      error.value = 'Failed to load projects. Please try again.';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchProjectBySlug(slug: string): Promise<SimpleProject | null> {
    isLoading.value = true;
    error.value = null;

    try {
      // Find by name/slug (since we don't have a slug field in the schema)
      const project = projects.value.find(
        (p: SimpleProject) => p.name.toLowerCase().replace(/\s+/g, '-') === slug,
      );

      if (project) {
        return project;
      }

      // If not found locally, fetch all projects and try again
      await fetchProjects();
      return (
        projects.value.find(
          (p: SimpleProject) => p.name.toLowerCase().replace(/\s+/g, '-') === slug,
        ) || null
      );
    } catch (err) {
      console.error(`Error fetching project with slug ${slug}:`, err);
      error.value = 'Failed to load project details. Please try again.';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleFavorite(id: string): Promise<void> {
    try {
      // Find the project in our local state
      const project = projects.value.find((p: SimpleProject) => p.id === id);
      if (!project) return;

      // For now, just update locally since we don't have a favorite field in the schema
      // In a real app, you'd update the database
      console.log(`Toggling favorite for project ${id}`);

      // This would be an API call to update the project
      // await updateProject(id, { /* favorite status */ });
    } catch (err) {
      console.error('Error toggling favorite status:', err);
      error.value = 'Failed to update favorite status. Please try again.';
    }
  }

  function getRelatedProjects(project: SimpleProject): SimpleProject[] {
    return projects.value
      .filter((p: SimpleProject) => p.id !== project.id && p.type === project.type)
      .slice(0, 3);
  }

  function filterByCategory(category: string): SimpleProject[] {
    return projects.value.filter((p: SimpleProject) => p.type === category);
  }

  function filterByStatus(status: SimpleProject['status']): SimpleProject[] {
    return projects.value.filter((p: SimpleProject) => p.status === status);
  }

  function searchProjects(query: string): SimpleProject[] {
    const searchQuery = query.toLowerCase();
    return projects.value.filter(
      (p: SimpleProject) =>
        p.name.toLowerCase().includes(searchQuery) ||
        p.description?.toLowerCase().includes(searchQuery) ||
        p.type?.toLowerCase().includes(searchQuery),
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
// DEPRECATED: useProjects composable has been removed. Use the Pinia store instead.
