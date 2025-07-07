#!/usr/bin/env node

/**
 * Local Supabase MCP Server
 * Provides MCP (Model Context Protocol) server functionality for local Supabase instances
 * Integrates with the existing self-hosted Supabase MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'

// Environment configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres'

class LocalSupabaseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'supabase-local',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupToolHandlers()
    this.setupErrorHandling()
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_local_status',
            description: 'Get status of local Supabase instance',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_local_config',
            description: 'Get configuration of local Supabase instance',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'execute_local_sql',
            description: 'Execute SQL against local Supabase database',
            inputSchema: {
              type: 'object',
              properties: {
                sql: {
                  type: 'string',
                  description: 'SQL query to execute',
                },
                readonly: {
                  type: 'boolean',
                  description: 'Whether to execute in read-only mode',
                  default: true,
                },
              },
              required: ['sql'],
            },
          },
          {
            name: 'list_local_tables',
            description: 'List all tables in local Supabase database',
            inputSchema: {
              type: 'object',
              properties: {
                schema: {
                  type: 'string',
                  description: 'Schema name (default: public)',
                  default: 'public',
                },
              },
            },
          },
          {
            name: 'get_table_schema',
            description: 'Get schema information for a specific table',
            inputSchema: {
              type: 'object',
              properties: {
                table: {
                  type: 'string',
                  description: 'Table name',
                },
                schema: {
                  type: 'string',
                  description: 'Schema name (default: public)',
                  default: 'public',
                },
              },
              required: ['table'],
            },
          },
        ],
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'get_local_status':
            return await this.getLocalStatus()

          case 'get_local_config':
            return await this.getLocalConfig()

          case 'execute_local_sql':
            return await this.executeLocalSQL(args.sql, args.readonly)

          case 'list_local_tables':
            return await this.listLocalTables(args.schema)

          case 'get_table_schema':
            return await this.getTableSchema(args.table, args.schema)

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            )
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`)
      }
    })
  }

  async getLocalStatus() {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: response.ok ? 'online' : 'offline',
              url: SUPABASE_URL,
              timestamp: new Date().toISOString(),
              response_status: response.status
            }, null, 2)
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              error: error.message,
              url: SUPABASE_URL,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      }
    }
  }

  async getLocalConfig() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            supabase_url: SUPABASE_URL,
            database_url: DATABASE_URL,
            has_anon_key: !!SUPABASE_ANON_KEY,
            has_service_key: !!SUPABASE_SERVICE_ROLE_KEY,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    }
  }

  async executeLocalSQL(sql, readonly = true) {
    try {
      // Use the self-hosted Supabase MCP server for SQL execution
      const { mcp_selfhosted_su_execute_sql } = await import('../mcp-tools/index.js')
      
      const result = await mcp_selfhosted_su_execute_sql({
        sql,
        read_only: readonly
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              sql,
              readonly,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      }
    }
  }

  async listLocalTables(schema = 'public') {
    const sql = `
      SELECT 
        table_name,
        table_type,
        table_schema
      FROM information_schema.tables 
      WHERE table_schema = $1
      ORDER BY table_name;
    `

    return await this.executeLocalSQL(sql.replace('$1', `'${schema}'`), true)
  }

  async getTableSchema(table, schema = 'public') {
    const sql = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_name = '${table}' 
        AND table_schema = '${schema}'
      ORDER BY ordinal_position;
    `

    return await this.executeLocalSQL(sql, true)
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error)
    }

    process.on('SIGINT', async () => {
      await this.server.close()
      process.exit(0)
    })
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('Local Supabase MCP server running on stdio')
  }
}

// Run the server
const server = new LocalSupabaseMCPServer()
server.run().catch((error) => {
  console.error('Failed to run server:', error)
  process.exit(1)
})
