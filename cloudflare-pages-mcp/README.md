# Cloudflare Pages MCP Server

MCP (Model Context Protocol) server for managing Cloudflare Pages deployments for cloudless.gr.

## Features

Following [MCP Tool Implementation Guide](https://github.com/cloudflare/mcp-server-cloudflare/blob/main/implementation-guides/tools.md) patterns:

- **Type-safe parameters** - All parameters validated with Zod schemas following `type-validators.md` guidelines
- **Robust error handling** - `isError` flag on all error responses
- **Clear LLM descriptions** - Each tool includes detailed usage guidance for LLM consumption
- **Evaluation tests** - Vitest-based tests following `evals.md` patterns

### Available Tools

| Tool | Description |
|------|-------------|
| `pages_list_projects` | List all Pages projects in the account |
| `pages_get_project` | Get details for a specific Pages project (requires `project_name`) |
| `pages_list_deployments` | List deployments for a project (requires `project_name`, optional `limit`) |
| `pages_get_deployment` | Get specific deployment details |
| `pages_get_deployment_logs` | Get logs for a specific deployment |
| `pages_create_project` | Create a new Pages project with build config |
| `pages_trigger_deployment` | Trigger a new deployment manually |
| `pages_delete_project` | Delete a Pages project (destructive) |

## Requirements

- Node.js 22+
- Cloudflare API Token with Pages permissions
- Cloudflare Account ID

## Environment Variables

```bash
CLOUDFLARE_API_TOKEN   # Your Cloudflare API token (required)
CLOUDFLARE_ACCOUNT_ID  # Your Cloudflare account ID (required)
```

## Installation

```bash
npm install
```

## Running

### Local (stdio mode)

```bash
npx tsx src/index.ts
```

### Docker

```bash
docker build -t cloudless-pages-mcp .
docker run -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID cloudless-pages-mcp
```

## Docker Compose

```bash
# From parent directory
docker-compose --profile mcp up cloudflare-pages-mcp
```

## Testing

### Unit Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Type Validators

The `src/types/pages.ts` file contains individual Zod validators following the MCP type validator patterns:

- `PagesProjectNameSchema` - Validates project name (alphanumeric, underscores, hyphens)
- `PagesDeploymentIdSchema` - Validates deployment ID
- `PagesListLimitSchema` - Validates pagination limit (1-100, default 10)
- `PagesBranchNameSchema` - Validates branch name
- `PagesProjectCreateSchema` - Validates project creation parameters
- `PagesDeploymentTriggerSchema` - Validates deployment trigger parameters

Each validator includes `.describe()` for LLM context as recommended in the implementation guide.

## Related Documentation

- [MCP Integration Guide](../../DevDocs/storage/markdown/devdocs-mcp-integration.md)
- [Migration Completion Status](../../DevDocs/storage/markdown/migration-completion.md)
- [MCP Tool Implementation Guide](https://github.com/cloudflare/mcp-server-cloudflare/blob/main/implementation-guides/tools.md)
- [MCP Type Validator Guide](https://github.com/cloudflare/mcp-server-cloudflare/blob/main/implementation-guides/type-validators.md)

## Architecture

```
cloudflare-pages-mcp/
├── src/
│   ├── index.ts           # Main MCP server with tool registration
│   ├── index.eval.ts      # Evaluation tests
│   └── types/
│       └── pages.ts       # Zod type validators
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Best Practices Followed

1. **Individual validators per field** - Each parameter has its own schema for LLM clarity
2. **Extensive `.describe()` usage** - All schemas include descriptions for LLM consumption
3. **Proper error handling** - Tools return `isError: true` on failures
4. **Clear tool descriptions** - Include when to use, expected inputs, and outputs
5. **Type-safe responses** - Generic typing on API helper for type safety
