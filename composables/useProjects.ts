// Composable to fetch and manage project data
import { computed, onMounted, ref } from 'vue';
import { getSupabaseClient } from './useSupabase';
import type { Project } from '~/types/project';

export interface ProjectFilter {
  status?: string;
  type?: string;
  search?: string;
}

export default function useProjects() {
  const projects = ref<Project[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const supabase = getSupabaseClient();
  // const user = useSupabaseUser(); // Not used, remove to fix lint error

  const featuredProjects = computed(() => {
    return projects.value.filter((project: Project) => project.status === 'active');
  });

  const recentProjects = computed(() => {
    return [...projects.value]
      .sort(
        (a: Project, b: Project) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      )
      .slice(0, 4);
  });

  async function fetchProjects(filter?: ProjectFilter): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      let query = supabase.from('projects').select('*').order('updated_at', { ascending: false });
      if (filter?.status) query = query.eq('status', filter.status);
      if (filter?.type) query = query.eq('type', filter.type);
      if (filter?.search) {
        // For search, fetch all and filter client-side (or use ilike if supported)
        const { data, error: searchError } = await supabase
          .from('projects')
          .select('*');
        if (searchError) throw searchError;
        projects.value = (data || []).filter((p: Project) =>
          p.name.toLowerCase().includes(filter.search!.toLowerCase()) ||
          (p.description?.toLowerCase().includes(filter.search!.toLowerCase()) ?? false) ||
          (p.type?.toLowerCase().includes(filter.search!.toLowerCase()) ?? false)
        );
        isLoading.value = false;
        return;
      }
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      projects.value = data || [];
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
      // Try to find in local state first
      const project = projects.value.find(
        (p: Project) => p.name.toLowerCase().replace(/\s+/g, '-') === slug,
      );
      if (project) return project;
      // Otherwise, fetch from Supabase
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .ilike('name', slug.replace(/-/g, ' '));
      if (fetchError) throw fetchError;
      return (data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error(`Error fetching project with slug ${slug}:`, err);
      error.value = 'Failed to load project details. Please try again.';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  // No 'favorite' field in schema; implement as a no-op or add logic if schema is updated
  async function toggleFavorite(_id: string): Promise<void> {
    // Not implemented: no 'favorite' field in projects table
    error.value = 'Favorite functionality is not available.';
  }

  function getRelatedProjects(project: Project): Project[] {
    return projects.value
      .filter((p: Project) => p.id !== project.id && p.type === project.type)
      .slice(0, 3);
  }

  function filterByCategory(category: string): Project[] {
    return projects.value.filter((p: Project) => p.type === category);
  }

  function filterByStatus(status: Project['status']): Project[] {
    return projects.value.filter((p: Project) => p.status === status);
  }

  function searchProjects(query: string): Project[] {
    const searchQuery = query.toLowerCase();
    return projects.value.filter(
      (p: Project) =>
        p.name.toLowerCase().includes(searchQuery) ||
        (p.description?.toLowerCase().includes(searchQuery) ?? false) ||
        (p.type?.toLowerCase().includes(searchQuery) ?? false)
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
// ...existing code...
// DEPRECATED: useProjects composable has been removed. Use the Pinia store instead.
