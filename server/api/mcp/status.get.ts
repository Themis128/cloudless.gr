/**
 * API endpoint to check MCP server status
 * Returns the connection status and available tools for both servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

interface McpServerStatus {
  connected: boolean
  tools?: Array<{
    name: string
    description: string
    inputSchema?: Record<string, unknown>
  }>
  error?: string
}

interface McpStatusResponse {
  database: McpServerStatus
  development: McpServerStatus
  timestamp: string
}

export default defineEventHandler(async (): Promise<McpStatusResponse> => {
  const response: McpStatusResponse = {
    database: { connected: false },
    development: { connected: false },
    timestamp: new Date().toISOString()
  }

  // Check Database MCP Server (local supabase server)
  try {
    const dbTransport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-tools/supabase-local-server.js'],
      cwd: process.cwd(),
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL || 'http://192.168.0.23:54321',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@192.168.0.23:54322/postgres'
      }
    })

    const dbClient = new Client({
      name: 'mcp-status-check-db',
      version: '1.0.0'
    }, {
      capabilities: {}
    })

    await dbClient.connect(dbTransport)
    
    // Get available tools
    const dbTools = await dbClient.listTools()
    
    response.database = {
      connected: true,
      tools: dbTools.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as Record<string, unknown>
      }))
    }

    await dbClient.close()
  } catch (error) {
    response.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Check Development MCP Server (nuxt-dev-server.js)
  try {
    const devTransport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-tools/nuxt-dev-server.js'],
      cwd: process.cwd()
    })

    const devClient = new Client({
      name: 'mcp-status-check-dev',
      version: '1.0.0'
    }, {
      capabilities: {}
    })

    await devClient.connect(devTransport)
    
    // Get available tools
    const devTools = await devClient.listTools()
    
    response.development = {
      connected: true,
      tools: devTools.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as Record<string, unknown>
      }))
    }

    await devClient.close()
  } catch (error) {
    response.development = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  return response
})
