# Context7 MCP Server Setup for cloudless.gr

## Setup Status: ✅ COMPLETED

The Context7 MCP server has been successfully installed and configured for cloudless.gr.

## Installation Details

### Server Location
- **Directory**: `/home/tbaltzakis/Cline/MCP/context7/`
- **Package**: `@upstash/context7-mcp` (version 3.2.4)
- **Node.js**: v22.22.1 (compatible)

### Available Tools
The Context7 MCP server provides two main tools:

1. **`resolve-library-id`** - Resolves a package/product name to a Context7-compatible library ID
   - Returns matching libraries with name, description, code snippets, and versions
   - Essential before using the query-docs tool

2. **`query-docs`** - Retrieves up-to-date documentation and code examples
   - Fetches current documentation from Context7's knowledge base
   - Returns working code examples for any library/framework

### Configuration
The server is configured in:
- **File**: `/home/tbaltzakis/.cline/data/settings/cline_mcp_settings.json`
- **Server Name**: `github.com/upstash/context7-mcp`
- **Transport**: stdio (default)
- **API Key**: Uses environment variable `CONTEXT7_API_KEY`

#### Current Configuration
```json
{
  "mcpServers": {
    "github.com/upstash/context7-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/context7-mcp",
        "--api-key",
        "${CONTEXT7_API_KEY}"
      ],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Getting an API Key

To enable full functionality with higher rate limits and access to private repositories:

1. Visit [https://context7.com/dashboard](https://context7.com/dashboard)
2. Create an account or log in
3. Generate an API key (starts with `ctx7sk` prefix)
4. Add the key to your environment:
   ```bash
   export CONTEXT7_API_KEY="ctx7sk_your_key_here"
   ```

### Alternative: Direct Configuration (Not Recommended for Security)
Instead of using environment variable, you can replace `${CONTEXT7_API_KEY}` with the actual key:
```json
"args": [
  "-y",
  "@upstash/context7-mcp",
  "--api-key",
  "ctx7sk_your_key_here"
]
```

## Usage

### For Cline Users
1. Open Cline
2. Go to **MCP Servers** section (hamburger menu ☰)
3. The Context7 server should appear in the configured servers list
4. When asking questions about libraries, frameworks, or APIs, Cline can automatically use Context7 to get up-to-date documentation

### Example Queries
```
How do I set up authentication with JWT in Express.js? use context7

How do I configure Tailwind CSS in a Next.js 14 project? use context7

What are the latest changes to the React Router API? use context7
```

### For Claude Code Users
Add the server with:
```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key ctx7sk_your_key
```

### For VS Code Users
The server is configured for Cline. For VS Code, add to `mcp.json`:
```json
{
  "servers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "ctx7sk_your_key"]
    }
  }
}
```

## Testing the Server

To verify the server is working (basic test without API key - limited functionality):

```bash
cd /home/tbaltzakis/Cline/MCP/context7
timeout 10 npx @upstash/context7-mcp --help
```

Expected output:
```
Usage: context7-mcp [options]

Options:
  -v, --version             output the current version
  --transport <stdio|http>  transport type (default: "stdio")
  --port <number>           port for HTTP transport (default: "3000")
  --api-key <key>           API key for authentication (or set CONTEXT7_API_KEY env var)
  -h, --help                display help for command
```

## Notes

- **Without API Key**: The server works but has lower rate limits
- **With API Key**: Full functionality with higher rate limits and access to more documentation
- **Transport Options**: 
  - `stdio` (default) - Best for local development
  - `http` - For remote servers (requires header-based auth)

## Files Created/Modified

1. **Created**: `/home/tbaltzakis/Cline/MCP/context7/` - Installation directory
2. **Modified**: `/home/tbaltzakis/.cline/data/settings/cline_mcp_settings.json` - Added Context7 configuration
3. **Created**: This summary document at `/home/tbaltzakis/cloudless.gr/CONTEXT7_SETUP_SUMMARY.md`

## Next Steps

1. Obtain a Context7 API key from https://context7.com/dashboard
2. Set the `CONTEXT7_API_KEY` environment variable
3. Restart Cline to reload MCP configuration
4. Test by asking a question that would benefit from up-to-date documentation