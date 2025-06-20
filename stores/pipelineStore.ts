import { defineStore } from 'pinia';
import type { PipelineConfig, Project } from '~/types/project';

export const usePipelineStore = defineStore('pipeline', {
  state: () => ({
    project: null as Project | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchProject(projectId: string) {
      this.loading = true;
      this.error = null;
      try {
        // Replace with real API call
        const response = await $fetch<{ data: Project }>(`/api/projects/${projectId}`);
        this.project = response.data;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to fetch project';
      } finally {
        this.loading = false;
      }
    },
    async updatePipelineConfig(projectId: string, config: PipelineConfig) {
      this.loading = true;
      this.error = null;
      try {
        await $fetch(`/api/projects/${projectId}/pipeline`, {
          method: 'PUT',
          body: { config },
        });
        if (this.project) {
          this.project.config = { ...this.project.config, pipeline: config };
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to update pipeline';
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});
