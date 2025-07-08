import { defineStore } from 'pinia';
import { useNuxtApp } from '#app';
import type { ApiEndpoint, Deployment, DeploymentConfig } from '~/types/project';

export const useDeploymentStore = defineStore('deployment', {
  state: () => ({
    deployments: [] as Deployment[],
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchDeployments(projectId: string) {
      this.loading = true;
      this.error = null;
      try {
        // Import SupabaseClient type at the top of the file:
        // import type { SupabaseClient } from '@supabase/supabase-js';
        const $supabase = useNuxtApp().$supabase as import('@supabase/supabase-js').SupabaseClient;
        const { data, error } = await $supabase
          .from('deployments')
          .select(`
            *,
            model_versions (
              id,
              version,
              project_id
            )
          `)
          .eq('model_versions.project_id', projectId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.deployments = data || [];
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch deployments';
        this.error = errorMsg;
      } finally {
        this.loading = false;
      }
    },
    async createDeployment(modelVersionId: string, config: DeploymentConfig, name: string) {
      this.loading = true;
      this.error = null;
      try {
        const $supabase = useNuxtApp().$supabase as import('@supabase/supabase-js').SupabaseClient;
        const { data, error } = await $supabase
          .from('deployments')
          .insert({
            model_version_id: modelVersionId,
            name,
            config,
            status: 'deploying',
          })
          .select()
          .single();
        if (error) throw error;
        if (data) this.deployments.unshift(data);
        return data;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create deployment';
        this.error = errorMsg;
        return null;
      } finally {
        this.loading = false;
      }
    },
    async updateDeploymentStatus(deploymentId: string, status: string, endpointUrl?: string) {
      this.loading = true;
      this.error = null;
      try {
        // Annotate $supabase for type safety
        const $supabase = useNuxtApp().$supabase as import('@supabase/supabase-js').SupabaseClient;
        const updateData: Record<string, unknown> = {
          status,
          updated_at: new Date().toISOString(),
        };
        if (endpointUrl) updateData.endpoint_url = endpointUrl;
        const { error } = await $supabase
          .from('deployments')
          .update(updateData)
          .eq('id', deploymentId);
        if (error) throw error;
        // Update local state
        // @ts-expect-error: Pinia/TypeScript deep type instantiation workaround
        const dep = this.deployments.find(d => d.id === deploymentId);
        if (dep) {
          dep.status = status;
          dep.updated_at = updateData.updated_at as string;
          if (endpointUrl) dep.endpoint_url = endpointUrl;
        }
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update deployment status';
        this.error = errorMsg;
        return false;
      } finally {
        this.loading = false;
      }
    },
    async deleteDeployment(deploymentId: string) {
      this.loading = true;
      this.error = null;
      try {
        const $supabase = useNuxtApp().$supabase as import('@supabase/supabase-js').SupabaseClient;
        const { error } = await $supabase.from('deployments').delete().eq('id', deploymentId);
        if (error) throw error;
        this.deployments = this.deployments.filter((d: Deployment) => d.id !== deploymentId);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete deployment';
        this.error = errorMsg;
        return false;
      } finally {
        this.loading = false;
      }
    },
    async scaleDeployment(deploymentId: string, instanceCount: number) {
      this.loading = true;
      this.error = null;
      try {
        const $supabase = useNuxtApp().$supabase as import('@supabase/supabase-js').SupabaseClient;
        // Fetch current config
        const dep = this.deployments.find((d: Deployment) => d.id === deploymentId);
        if (!dep || !dep.config) throw new Error('Deployment not found or missing config');
        const updatedConfig = {
          ...(typeof dep.config === 'object' && dep.config !== null ? dep.config : {}),
          instance_count: instanceCount,
          instance_type: dep.config.instance_type || 'standard',
        };
        const { error } = await $supabase
          .from('deployments')
          .update({
            config: updatedConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deploymentId);
        if (error) throw error;
        dep.config = updatedConfig;
        dep.updated_at = new Date().toISOString();
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to scale deployment';
        this.error = errorMsg;
        return false;
      } finally {
        this.loading = false;
      }
    },
    generateApiEndpoints(deployment: Deployment): ApiEndpoint[] {
      const baseUrl = deployment.endpoint_url || '';
      return [
        {
          id: `endpoint_${deployment.id}_predict`,
          deployment_id: deployment.id,
          method: 'POST',
          path: '/predict',
          url: `${baseUrl}/predict`,
          description: 'Make predictions using the deployed model',
          authenticated: true,
          rateLimit: '1000/hour',
        },
        {
          id: `endpoint_${deployment.id}_health`,
          deployment_id: deployment.id,
          method: 'GET',
          path: '/health',
          url: `${baseUrl}/health`,
          description: 'Check deployment health status',
          authenticated: false,
          rateLimit: 'unlimited',
        },
        {
          id: `endpoint_${deployment.id}_metrics`,
          deployment_id: deployment.id,
          method: 'GET',
          path: '/metrics',
          url: `${baseUrl}/metrics`,
          description: 'Get deployment metrics and statistics',
          authenticated: true,
          rateLimit: '100/hour',
        },
      ];
    },
    async getDeploymentMetrics(_deploymentId: string) {
      // This would typically fetch from a monitoring service
      // For now, return mock data
      return {
        requests_per_minute: Math.floor(Math.random() * 100),
        avg_response_time: Math.floor(Math.random() * 200) + 50,
        error_rate: Math.random() * 0.05,
        uptime_percentage: 95 + Math.random() * 5,
        last_check: new Date().toISOString(),
      };
    },
  },
});
