/**
 * Nuxt Composable for MCP Server Integration
 * Provides access to both Database and Development MCP servers from within the app
 */

import type { Ref, ComputedRef } from 'vue'

interface McpTool {
  name: string
  description: string
  inputSchema?: Record<string, unknown>
}

interface McpServerInfo {
  name: string
  status: 'connected' | 'disconnected' | 'connecting'
  tools: McpTool[]
  lastUpdate: Date
}

interface McpApiResponse {
  database?: {
    connected: boolean
    tools?: McpTool[]
  }
  development?: {
    connected: boolean
    tools?: McpTool[]
  }
}

interface McpToolResult {
  content?: Array<{ text: string }>
}

interface McpIntegration {
  database: Readonly<Ref<McpServerInfo>>
  development: Readonly<Ref<McpServerInfo>>
  isReady: ComputedRef<boolean>
  refreshServers: () => Promise<void>
  callDatabaseTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  callDevelopmentTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  scaffoldComponent: (name: string, template?: string) => Promise<string>
  analyzeProject: () => Promise<string>
  queryDatabase: (query: string) => Promise<unknown>
  listComponents: () => Promise<string[]>
  listPages: () => Promise<string[]>
}

export const useMcpIntegration = (): McpIntegration => {
  // Reactive state for MCP servers
  const database = ref<McpServerInfo>({
    name: 'Supabase Database',
    status: 'disconnected',
    tools: [],
    lastUpdate: new Date()
  })

  const development = ref<McpServerInfo>({
    name: 'Nuxt Development',
    status: 'disconnected', 
    tools: [],
    lastUpdate: new Date()
  })

  // Computed property to check if both servers are ready
  const isReady = computed(() => 
    database.value.status === 'connected' && 
    development.value.status === 'connected'
  )

  /**
   * Check MCP server status via API endpoint
   */
  const refreshServers = async () => {
    try {
      // Call our server API to check MCP status
      const response = await $fetch<McpApiResponse>('/api/mcp/status')
      
      if (response.database) {
        database.value = {
          ...database.value,
          status: response.database.connected ? 'connected' : 'disconnected',
          tools: response.database.tools || [],
          lastUpdate: new Date()
        }
      }

      if (response.development) {
        development.value = {
          ...development.value,
          status: response.development.connected ? 'connected' : 'disconnected',
          tools: response.development.tools || [],
          lastUpdate: new Date()
        }
      }
    } catch (error) {
      console.error('Failed to refresh MCP server status:', error)
      database.value.status = 'disconnected'
      development.value.status = 'disconnected'
    }
  }

  /**
   * Call a database MCP tool
   */
  const callDatabaseTool = async (toolName: string, args: Record<string, unknown>) => {
    try {
      const response = await $fetch('/api/mcp/database/call', {
        method: 'POST',
        body: { tool: toolName, arguments: args }
      })
      return response
    } catch (error) {
      console.error('Database MCP tool call failed:', error)
      throw error
    }
  }

  /**
   * Call a development MCP tool
   */
  const callDevelopmentTool = async (toolName: string, args: Record<string, unknown>) => {
    try {
      const response = await $fetch('/api/mcp/development/call', {
        method: 'POST',
        body: { tool: toolName, arguments: args }
      })
      return response
    } catch (error) {
      console.error('Development MCP tool call failed:', error)
      throw error
    }
  }

  /**
   * High-level helper: Scaffold a new component
   */
  const scaffoldComponent = async (name: string, template: string = 'basic') => {
    try {
      const result = await callDevelopmentTool('scaffold-nuxt-component', {
        name,
        template
      }) as McpToolResult
      
      // Refresh to update component list
      await refreshServers()
      
      return result.content?.[0]?.text || 'Component created successfully'
    } catch (error) {
      throw new Error(`Failed to scaffold component: ${error}`)
    }
  }

  /**
   * High-level helper: Analyze project structure
   */
  const analyzeProject = async () => {
    try {
      const result = await callDevelopmentTool('analyze-project-structure', {}) as McpToolResult
      return result.content?.[0]?.text || 'Analysis completed'
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error}`)
    }
  }

  /**
   * High-level helper: Query database
   */
  const queryDatabase = async (query: string) => {
    try {
      const result = await callDatabaseTool('query', { query })
      return result
    } catch (error) {
      throw new Error(`Database query failed: ${error}`)
    }
  }

  /**
   * High-level helper: List components
   */
  const listComponents = async (): Promise<string[]> => {
    try {
      const result = await callDevelopmentTool('list-nuxt-components', {}) as McpToolResult
      const componentText = result.content?.[0]?.text || ''
      
      // Parse component list from text response
      const components = componentText
        .split('\n')
        .filter((line: string) => line.trim().startsWith('- '))
        .map((line: string) => line.replace(/^- /, '').trim())
        .filter(Boolean)
      
      return components
    } catch (error) {
      console.error('Failed to list components:', error)
      return []
    }
  }

  /**
   * High-level helper: List pages
   */
  const listPages = async (): Promise<string[]> => {
    try {
      const result = await callDevelopmentTool('list-nuxt-pages', {}) as McpToolResult
      const pageText = result.content?.[0]?.text || ''
      
      // Parse page list from text response
      const pages = pageText
        .split('\n')
        .filter((line: string) => line.trim().startsWith('- '))
        .map((line: string) => line.replace(/^- /, '').split(' → ')[0].trim())
        .filter(Boolean)
      
      return pages
    } catch (error) {
      console.error('Failed to list pages:', error)
      return []
    }
  }

  // Auto-refresh on mount
  onMounted(() => {
    refreshServers()
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(refreshServers, 30000)
    
    // Cleanup on unmount
    onUnmounted(() => {
      clearInterval(interval)
    })
  })

  return {
    database: readonly(database),
    development: readonly(development),
    isReady,
    refreshServers,
    callDatabaseTool,
    callDevelopmentTool,
    scaffoldComponent,
    analyzeProject,
    queryDatabase,
    listComponents,
    listPages
  }
}
