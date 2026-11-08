# AWS Knowledge MCP Server
> **Historical — Cognito retired.** auth is Cloudflare D1 (`user-auth-db`, `src/lib/auth-d1.ts`, opaque `session_token` cookies). Cognito references below describe the old AWS stack. Kept for reference — do not follow as current ops.


Remote MCP server providing up-to-date AWS documentation, best practices, and regional availability information.

## Configuration

This server is configured in `~/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` as:

```json
"github.com/awslabs/mcp/tree/main/src/aws-knowledge-mcp-server": {
  "disabled": false,
  "timeout": 60,
  "type": "stdio",
  "command": "npx",
  "args": ["mcp-remote", "https://knowledge-mcp.global.api.aws"]
}
```

## Available Tools

1. **search_documentation** - Search AWS docs, agent skills, Strands Agents docs
2. **read_documentation** - Retrieve AWS docs as markdown
3. **list_regions** - Get all AWS regions
4. **get_regional_availability** - Check regional availability for services/APIs
5. **retrieve_skill** - Get domain-specific AWS expertise packages

## Use Cases for cloudless.gr

- Lambda cold start optimization (Node.js 22, ARM64)
- Cognito security best practices
- DynamoDB TTL patterns
- Bedrock integration guidance
- SST/CDK infrastructure guidance
