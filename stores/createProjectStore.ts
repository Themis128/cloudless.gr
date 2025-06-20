import { defineStore } from 'pinia';

export const useCreateProjectStore = defineStore('createProject', {
  state: () => ({
    loading: false,
    error: null as string | null,
    createdProject: null as any,
  }),
  actions: {
    async createProject(projectData: {
      name: string;
      description?: string;
      type: 'cv' | 'nlp' | 'regression' | 'recommendation' | 'time-series' | 'custom';
      framework?: string;
      config?: Record<string, any>;
    }) {
      this.loading = true;
      this.error = null;
      try {
        const supabase = useSupabaseClient<any>() as import('@supabase/supabase-js').SupabaseClient;
        const user = useSupabaseUser();
        if (!user.value) throw new Error('User must be authenticated to create projects');
        const projectPayload = {
          name: projectData.name,
          description: projectData.description ?? null,
          type: projectData.type,
          framework: projectData.framework ?? null,
          config: projectData.config || {},
          owner_id: user.value.id,
        };
        const { data, error: insertError } = await supabase
          .from('projects')
          .insert([projectPayload] as any)
          .select()
          .single();
        if (insertError) throw new Error(`Failed to create project: ${insertError.message}`);
        this.createdProject = data;
        return data;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to create project';
        return null;
      } finally {
        this.loading = false;
      }
    },
  },
});
