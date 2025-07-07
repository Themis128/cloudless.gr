/**
 * API endpoint to call development MCP tools
 * Handles tool calls to the Nuxt development MCP server
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

    // Connect to Development MCP Server
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['mcp-tools/nuxt-dev-server.js'],
      cwd: process.cwd()
    })

    const client = new Client({
      name: 'nuxt-mcp-development-client',
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
