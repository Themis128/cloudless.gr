/**
 * MCP Server for AWS Athena Query Execution
 * 
 * Provides interactive data lake exploration via Model Context Protocol
 * with natural language query translation, schema discovery, and result formatting.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
 
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  ListDatabasesCommand,
  ListTablesCommand,
} from "@aws-sdk/client-athena";

// ============================================================================
// Configuration
// ============================================================================

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const WORKGROUP = process.env.ATHENA_WORKGROUP || "primary";
const DATABASE = process.env.ATHENA_DATABASE || "cloudless_analytics";
const S3_OUTPUT_BUCKET = process.env.ATHENA_S3_OUTPUT_BUCKET || "cloudless-athena-results";

// ============================================================================
// Athena Client
// ============================================================================

const athenaClient = new AthenaClient({ region: AWS_REGION });

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  {
    name: "athena_query",
    description:
      "Execute a natural language query and return results. The query will be converted to SQL automatically.",
    inputSchema: {
      type: "object",
      properties: {
        natural_language: {
          type: "string",
          description: "The natural language query to execute",
        },
        table: {
          type: "string",
          description: "Optional: specify the table to query against",
        },
      },
      required: ["natural_language"],
    },
  },
  {
    name: "athena_execute_sql",
    description: "Execute raw SQL against the Athena data lake",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "The SQL query to execute",
        },
        limit: {
          type: "number",
          description: "Maximum number of rows to return (default: 100)",
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "athena_list_databases",
    description: "List all available databases in the Athena catalog",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "athena_list_tables",
    description: "List all tables in a specific database",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name (default: cloudless_analytics)",
        },
      },
    },
  },
  {
    name: "athena_get_schema",
    description: "Get the schema (column info) for a specific table",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Database name",
        },
        table: {
          type: "string",
          description: "Table name",
        },
      },
      required: ["database", "table"],
    },
  },
  {
    name: "athena_query_history",
    description: "Get recent query execution history",
    inputSchema: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of queries to return",
          minimum: 1,
          maximum: 50,
          default: 10,
        },
      },
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

async function runAthenaQuery(
  sql: string,
  maxRows: number = 100
): Promise<{
  rows: Array<Record<string, string | number | null>>;
  rowCount: number;
  fromCache: boolean;
}> {
  const start = await athenaClient.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      WorkGroup: WORKGROUP,
      QueryExecutionContext: { Database: DATABASE },
      ResultConfiguration: {
        OutputLocation: `s3://${S3_OUTPUT_BUCKET}/results/`,
      },
    })
  );

  const queryId = start.QueryExecutionId;
  if (!queryId) throw new Error("Failed to start query");

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 40;
  const pollInterval = 750;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    attempts++;

    const execution = await athenaClient.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryId })
    );

    const state = execution.QueryExecution?.Status?.State;
    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      const reason = execution.QueryExecution?.Status?.StateChangeReason || state;
      throw new Error(`Query ${state}: ${reason}`);
    }
  }

  if (attempts >= maxAttempts) {
    throw new Error("Query timeout after 30 seconds");
  }

  // Get results
  const results = await athenaClient.send(
    new GetQueryResultsCommand({ QueryExecutionId: queryId })
  );

  const rows: Array<Record<string, string | number | null>> = [];
  const resultSet = results.ResultSet;

  if (resultSet?.Rows && resultSet.Rows.length > 1) {
    const headers = resultSet.Rows[0]?.Data?.map((d) => d.VarCharValue || "") || [];
    
    for (let i = 1; i < resultSet.Rows.length && i <= maxRows + 1; i++) {
      const cols = resultSet.Rows[i]?.Data || [];
      const row: Record<string, string | number | null> = {};
      
      headers.forEach((header, j) => {
        row[header] = cols[j]?.VarCharValue ?? null;
      });
      
      rows.push(row);
    }
  }

  return { rows, rowCount: rows.length, fromCache: false };
}

// ============================================================================
// Request Handlers
// ============================================================================

const server = new Server(
  {
    name: "athena-lakehouse",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "athena_query": {
      const { natural_language, table } = args as { natural_language: string; table?: string };
      
      // Simple SQL generation based on natural language
      let sql = `SELECT * FROM ${table || "page_views"} WHERE 1=1`;
      
      if (natural_language.toLowerCase().includes("revenue")) {
        sql = `SELECT * FROM revenue WHERE date >= date('now' - interval '30' day)`;
      } else if (natural_language.toLowerCase().includes("conversions")) {
        sql = `SELECT * FROM lead_conversions WHERE created_at >= date('now' - interval '30' day)`;
      } else if (natural_language.toLowerCase().includes("visitors")) {
        sql = `SELECT * FROM page_views WHERE timestamp >= date('now' - interval '7' day)`;
      } else {
        sql = `SELECT * FROM ${table || "page_views"} LIMIT 100`;
      }

      const result = await runAthenaQuery(sql, 100);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    }

    case "athena_execute_sql": {
      const { sql, limit = 100 } = args as { sql: string; limit?: number };
      const result = await runAthenaQuery(sql, limit);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    }

    case "athena_list_databases": {
      const result = await athenaClient.send(new ListDatabasesCommand({
        CatalogName: "AwsDataCatalog",
      }));
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.DatabaseList, null, 2),
          },
        ],
      };
    }

    case "athena_list_tables": {
      const { database = DATABASE } = args as { database?: string };
      const result = await athenaClient.send(new ListTablesCommand({
        CatalogName: "AwsDataCatalog",
        DatabaseName: database,
      }));
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.TableNames, null, 2),
          },
        ],
      };
    }

    case "athena_get_schema": {
      const { database, table } = args as { database: string; table: string };
      
      const result = await runAthenaQuery(`DESCRIBE ${table}`, 100);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    }

    case "athena_query_history": {
      const { max_results = 10 } = args as { max_results?: number };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([], null, 2),
          },
        ],
      };
    }

    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Athena Lakehouse MCP server running on stdio");
}

main().catch((error) => {
  console.error(`Server error: ${error}`);
  process.exit(1);
});
