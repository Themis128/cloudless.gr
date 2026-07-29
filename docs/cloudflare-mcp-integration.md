# Cloudflare MCP Servers Integration

This document describes the Cloudflare MCP (Model Context Protocol) servers available for the cloudless.gr application.

## Cloudflare MCP Server Types

Cloudflare provides two categories of MCP servers:

| Type | Description |
|------|-------------|
| Code Mode server | Best for broad API coverage across many products (`@cloudflare/mcp-server-cloudflare`) |
| Domain-specific servers | Purpose-built tools for specific product areas (`*.mcp.cloudflare.com/mcp`) |

## Configured MCP Servers

The following MCP servers are configured in `.cline/data/settings/cline_mcp_settings.json`:

| Server | URL | Purpose | Auto-start | API Token Required |
|--------|-----|---------|------------|-------------------|
| `cloudflare` | `@cloudflare/mcp-server-cloudflare` | General Cloudflare API access (Code Mode) | ✅ Yes | ✅ Yes |
| `cloudflare-bindings` | `https://bindings.mcp.cloudflare.com/mcp` | KV, Workers, R2, D1, Hyperdrive | ✅ Yes | ✅ Yes |
| `cloudflare-builds` | `https://builds.mcp.cloudflare.com/mcp` | Workers Builds insights | ❌ No | ✅ Yes |
| `cloudflare-observability` | `https://observability.mcp.cloudflare.com/mcp` | Logs, analytics, debugging | ❌ No | ✅ Yes |
| `cloudflare-containers` | `https://containers.mcp.cloudflare.com/mcp` | Sandbox environments | ❌ No | ✅ Yes |
| `cloudflare-logpush` | `https://logs.mcp.cloudflare.com/mcp` | Logpush job health | ❌ No | ✅ Yes |
| `cloudflare-ai-gateway` | `https://ai-gateway.mcp.cloudflare.com/mcp` | AI Gateway logs/requests | ❌ No | ✅ Yes |
| `cloudflare-auditlogs` | `https://auditlogs.mcp.cloudflare.com/mcp` | Audit log queries | ❌ No | ✅ Yes |
| `cloudflare-dns-analytics` | `https://dns-analytics.mcp.cloudflare.com/mcp` | DNS performance | ❌ No | ✅ Yes |
| `cloudflare-dex` | `https://dex.mcp.cloudflare.com/mcp` | Digital Experience Monitoring | ❌ No | ✅ Yes |
| `cloudflare-casb` | `https://casb.mcp.cloudflare.com/mcp` | SaaS security misconfigurations | ❌ No | ✅ Yes |
| `cloudflare-docs` | `https://docs.mcp.cloudflare.com/mcp` | Cloudflare documentation | ❌ No | ❌ No |
| `cloudflare-blog` | `https://blog.mcp.cloudflare.com/mcp` | Cloudflare blog posts | ❌ No | ❌ No |
| `cloudflare-graphql` | `https://graphql.mcp.cloudflare.com/mcp` | GraphQL analytics | ❌ No | ✅ Yes |

## Required Environment Variables

Add the following to your `.env.local` file:

```bash
# Cloudflare API Token with appropriate permissions
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=fb7dc7b69b662480cd5961a4d1913c78
```

### API Token Permissions

For the **bindings server**, create a token with:

- Account Settings: Read
- Workers Scripts: Read & Write
- KV Storage: Read & Write
- R2 Storage: Read & Write
- D1 Database: Read & Write
- Hyperdrive: Read & Write

For **observability**, add:

- Workers Telemetry: Read
- Logpush: Read

For **browser rendering**, add:

- Browser Rendering: Read

## Available Tools by Server

### cloudflare-bindings (Most Relevant for cloudless.gr)

Since cloudless.gr uses:

- KV namespaces
- Workers
- R2 buckets
- D1 databases
- Hyperdrive

You can use these tools directly:

**KV Namespaces:**

- `kv_namespaces_list` - List all KV namespaces
- `kv_namespace_create` - Create a new namespace
- `kv_namespace_delete` - Delete a namespace
- `kv_namespace_get` - Get namespace details
- `kv_namespace_update` - Update namespace title

**Workers:**

- `workers_list` - List all Workers
- `workers_get_worker` - Get Worker details
- `workers_get_worker_code` - Get Worker source code

**R2 Buckets:**

- `r2_buckets_list` - List all buckets
- `r2_bucket_create` - Create a bucket
- `r2_bucket_get` - Get bucket details
- `r2_bucket_delete` - Delete a bucket

**D1 Databases:**

- `d1_databases_list` - List all D1 databases
- `d1_database_create` - Create a database
- `d1_database_delete` - Delete a database
- `d1_database_get` - Get database details
- `d1_database_query` - Execute SQL queries

**Hyperdrive:**

- `hyperdrive_configs_list` - List Hyperdrive configs
- `hyperdrive_config_create` - Create a config
- `hyperdrive_config_delete` - Delete a config
- `hyperdrive_config_get` - Get config details
- `hyperdrive_config_edit` - Edit a config

### cloudflare (General Purpose)

The general Cloudflare MCP server provides:

- Pages deployment management
- DNS zone/record management
- Account information
- Workers listing

### cloudflare-docs

Search and read Cloudflare documentation for:

- API references
- Worker development guides
- Feature documentation

### cloudflare-browser

Useful for:

- Screenshot capture for monitoring
- Web page content extraction
- Markdown conversion of web pages

### cloudflare-observability

Access:

- Workers logs
- Analytics data
- Deployment traces

## Using MCP Servers

### Via Cline/Claude

Once configured, the MCP servers are automatically available. Just reference them in your prompts:

```
"Use the cloudflare-bindings server to list my KV namespaces"
"Check my R2 bucket configuration using cloudflare-bindings"
"Query the auth-db database using d1_database_query"
```

### MCP Client Configuration

If using with other MCP clients, add to your configuration:

```json
{
  "mcpServers": {
    "cloudflare-bindings": {
      "command": "npx",
      "args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/mcp"]
    }
  }
}
```

## Troubleshooting

### "Claude's response was interrupted"

This indicates the server hit context limits. Try:

- Being more specific in your queries
- Breaking requests into smaller tool calls
- Limiting the scope of queries

### Authentication Errors

Ensure:

- `CLOUDFLARE_API_TOKEN` is valid and not expired
- Token has all required permissions
- Account ID is correct

### Connection Issues

If local development has connectivity issues:

1. Check wrangler is logged in: `pnpm wrangler whoami`
2. Verify API token in Cloudflare dashboard
3. Check network connectivity to Cloudflare services

## Local Development

To run MCP servers locally via Docker, see:
`../../mcp-server-cloudflare/README.md`
