/**
 * API endpoint to call database MCP tools
 * Handles tool calls to the Supabase MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

interface McpToolRequest {
  tool: string
  arguments: Record<string, unknown>
}

interface McpToolResponse {
  success: boolean
  result?: unknown
  error?: string
}

export default defineEventHandler(async (event): Promise<McpToolResponse> => {
  try {
    const body = await readBody<McpToolRequest>(event)
    
    if (!body.tool) {
      throw new Error('Tool name is required')
    }

    // Connect to Database MCP Server (local)
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-tools/supabase-local-server.js'],
      cwd: process.cwd(),
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL || 'http://192.168.0.23:54321',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@192.168.0.23:54322/postgres'
      }
    })

    const client = new Client({
      name: 'nuxt-mcp-database-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    })

    await client.connect(transport)

    try {
      // Call the specified tool with arguments
      const result = await client.callTool({
        name: body.tool,
        arguments: body.arguments || {}
      })

      await client.close()

      return {
        success: true,
        result: result.content
      }
    } catch (toolError) {
      await client.close()
      throw toolError
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
})
