import { defineStore } from 'pinia'

// Simplified interfaces for analytics pipeline
export interface AnalyticsPipeline {
  id: string
  project_id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'archived' | 'failed'
  config: Record<string, unknown>
  owner_id: string
  created_at: string
  updated_at: string
}

export interface PipelineStep {
  id: string
  pipeline_id: string
  step_type: 'DataInput' | 'DataValidation' | 'SmartProcessing' | 'MLAnalytics' | 'Visualization' | 'ReportGeneration'
  name: string
  description: string
  position: number
  config: Record<string, unknown>
  is_configured: boolean
  created_at: string
  updated_at: string
}

export interface PipelineExecution {
  id: string
  pipeline_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  logs: string
  error_message: string | null
  results: Record<string, unknown> | null
  executed_by: string
  created_at: string
}

export interface DataSource {
  id: string
  name: string
  type: 'file' | 'database' | 'api' | 'cloud'
  connection_config: Record<string, unknown>
  owner_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AnalyticsPipelineState {
  pipelines: AnalyticsPipeline[]
  currentPipeline: AnalyticsPipeline | null
  dataSources: DataSource[]
  executions: PipelineExecution[]
  loading: boolean
  error: string | null
}

export const useAnalyticsPipelineStore = defineStore('analyticsPipeline', {
  state: (): AnalyticsPipelineState => ({
    pipelines: [],
    currentPipeline: null,
    dataSources: [],
    executions: [],
    loading: false,
    error: null,
  }),

  getters: {
    activePipelines: (state) => state.pipelines.filter(p => p.status === 'active'),
    draftPipelines: (state) => state.pipelines.filter(p => p.status === 'draft'),
    pipelinesByProject: (state) => (projectId: string) => 
      state.pipelines.filter(p => p.project_id === projectId),    pipelineSteps: (_state) => (_pipelineId: string) => 
      // This would typically fetch from a separate steps array, but for now return empty
      [] as PipelineStep[],
    recentExecutions: (state) => 
      state.executions.slice(0, 10).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
  },

  actions: {
    async fetchPipelines(projectId?: string): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // For now, use mock data - in the future this would connect to Supabase
        this.pipelines = this.getMockPipelines(projectId)
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch pipelines'
        console.error('Error fetching pipelines:', error)
      } finally {
        this.loading = false
      }
    },

    async createPipeline(pipeline: Omit<AnalyticsPipeline, 'id' | 'created_at' | 'updated_at'>): Promise<AnalyticsPipeline | null> {
      this.loading = true
      this.error = null

      try {
        const newPipeline: AnalyticsPipeline = {
          ...pipeline,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        this.pipelines.push(newPipeline)
        return newPipeline
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create pipeline'
        console.error('Error creating pipeline:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async updatePipeline(pipelineId: string, updates: Partial<AnalyticsPipeline>): Promise<boolean> {
      try {
        const pipeline = this.pipelines.find(p => p.id === pipelineId)
        if (pipeline) {
          Object.assign(pipeline, updates, { updated_at: new Date().toISOString() })
          return true
        }
        return false
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update pipeline'
        console.error('Error updating pipeline:', error)
        return false
      }
    },

    async deletePipeline(pipelineId: string): Promise<boolean> {
      try {
        const index = this.pipelines.findIndex(p => p.id === pipelineId)
        if (index !== -1) {
          this.pipelines.splice(index, 1)
          if (this.currentPipeline?.id === pipelineId) {
            this.currentPipeline = null
          }
          return true
        }
        return false
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to delete pipeline'
        console.error('Error deleting pipeline:', error)
        return false
      }
    },

    async executePipeline(pipelineId: string, _config?: Record<string, unknown>): Promise<PipelineExecution | null> {
      this.loading = true
      this.error = null

      try {
        const execution: PipelineExecution = {
          id: Date.now().toString(),
          pipeline_id: pipelineId,
          status: 'pending',
          started_at: new Date().toISOString(),
          completed_at: null,
          duration_seconds: null,
          logs: 'Pipeline execution started...',
          error_message: null,
          results: null,
          executed_by: 'current_user', // This would come from auth
          created_at: new Date().toISOString(),
        }

        this.executions.unshift(execution)

        // Simulate execution progress
        setTimeout(() => {
          execution.status = 'running'
          execution.logs += '\nProcessing data...'
        }, 1000)

        setTimeout(() => {
          execution.status = 'completed'
          execution.completed_at = new Date().toISOString()
          execution.duration_seconds = 45
          execution.logs += '\nPipeline execution completed successfully.'
          execution.results = { processed_records: 1000, output_file: 'results.csv' }
        }, 5000)

        return execution
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to execute pipeline'
        console.error('Error executing pipeline:', error)
        return null
      } finally {
        this.loading = false
      }
    },

    async fetchDataSources(): Promise<void> {
      this.loading = true
      this.error = null

      try {
        // For now, use mock data
        this.dataSources = this.getMockDataSources()
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to fetch data sources'
        console.error('Error fetching data sources:', error)
      } finally {
        this.loading = false
      }
    },

    async createDataSource(dataSource: Omit<DataSource, 'id' | 'created_at' | 'updated_at'>): Promise<DataSource | null> {
      try {
        const newDataSource: DataSource = {
          ...dataSource,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        this.dataSources.push(newDataSource)
        return newDataSource
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create data source'
        console.error('Error creating data source:', error)
        return null
      }
    },

    setCurrentPipeline(pipeline: AnalyticsPipeline | null) {
      this.currentPipeline = pipeline
    },

    clearError() {
      this.error = null
    },

    // Mock data methods
    getMockPipelines(projectId?: string): AnalyticsPipeline[] {
      const mockPipelines: AnalyticsPipeline[] = [
        {
          id: '1',
          project_id: projectId || 'project1',
          name: 'User Behavior Analysis',
          description: 'Analyze user behavior patterns and generate insights',
          status: 'active',
          config: { source: 'user_events', output: 'dashboard' },
          owner_id: 'user1',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          project_id: projectId || 'project1',
          name: 'Sales Performance Dashboard',
          description: 'Real-time sales metrics and performance tracking',
          status: 'active',
          config: { source: 'sales_data', refresh_interval: 300 },
          owner_id: 'user1',
          created_at: new Date(Date.now() - 172800000).toISOString(),
          updated_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          project_id: projectId || 'project2',
          name: 'Customer Segmentation',
          description: 'ML-based customer segmentation and targeting',
          status: 'draft',
          config: { algorithm: 'kmeans', features: ['age', 'spending', 'frequency'] },
          owner_id: 'user1',
          created_at: new Date(Date.now() - 259200000).toISOString(),
          updated_at: new Date(Date.now() - 10800000).toISOString(),
        },
      ]

      return projectId ? mockPipelines.filter(p => p.project_id === projectId) : mockPipelines
    },

    getMockDataSources(): DataSource[] {
      return [
        {
          id: '1',
          name: 'Main Database',
          type: 'database',
          connection_config: { host: 'db.example.com', database: 'analytics' },
          owner_id: 'user1',
          is_active: true,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '2',
          name: 'Sales CSV Files',
          type: 'file',
          connection_config: { path: '/data/sales/', format: 'csv' },
          owner_id: 'user1',
          is_active: true,
          created_at: new Date(Date.now() - 172800000).toISOString(),
          updated_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '3',
          name: 'External API',
          type: 'api',
          connection_config: { url: 'https://api.example.com/data', auth_type: 'bearer' },
          owner_id: 'user1',
          is_active: true,
          created_at: new Date(Date.now() - 259200000).toISOString(),
          updated_at: new Date(Date.now() - 259200000).toISOString(),
        },
      ]
    },
  },
})
