# Context7 MCP Server Tools Demonstration

## Available Tools

The Context7 MCP server provides two main tools:

### 1. `resolve-library-id`
Resolves a general library name into a Context7-compatible library ID.

**Parameters:**
- `query` (required): The user's question or task
- `libraryName` (required): The name of the library to search for

**Example Usage:**
```json
{
  "name": "resolve-library-id",
  "arguments": {
    "query": "How do I set up authentication with JWT in Express.js?",
    "libraryName": "express"
  }
}
```

**Expected Response:**
Returns matching libraries with:
- Library ID (e.g., `/expressjs/express`)
- Name and description
- Code snippets and versions
- Related documentation

### 2. `query-docs`
Retrieves documentation for a library using a Context7-compatible library ID.

**Parameters:**
- `libraryId` (required): Exact Context7-compatible library ID (e.g., `/mongodb/docs`, `/vercel/next.js`)
- `query` (required): The question or task to get relevant documentation for

**Example Usage:**
```json
{
  "name": "query-docs",
  "arguments": {
    "libraryId": "/expressjs/express",
    "query": "How do I set up JWT authentication middleware?"
  }
}
```

**Expected Response:**
Returns up-to-date documentation including:
- Current API documentation
- Code examples
- Best practices
- Version-specific information

## Testing the Tools

### Method 1: Via MCP Client Interface

If using Cline:
1. Open Cline
2. Go to MCP Servers section
3. Find "github.com/upstash/context7-mcp"
4. Use prompts like:
   - "What are the latest changes to Next.js 15? use context7"
   - "How do I configure Tailwind CSS in a Next.js project? use context7"

### Method 2: Direct Testing

To test the tools directly, you need:
1. An API key from https://context7.com/dashboard
2. Set the environment variable: `export CONTEXT7_API_KEY="ctx7sk_your_key_here"`
3. Run the server: `npx @upstash/context7-mcp --api-key ctx7sk_your_key_here`

### Method 3: Test Without API Key (Limited)

The server can run without an API key but with limited functionality:
```bash
npx @upstash/context7-mcp --help
```

This will show the server help but won't provide full documentation access.

## Integration with Cline

The Context7 MCP server is already configured in:
- **File**: `/home/tbaltzakis/.cline/data/settings/cline_mcp_settings.json`
- **Server Name**: `github.com/upstash/context7-mcp`
- **Transport**: stdio (default)

## Next Steps

To fully demonstrate the tools:
1. Obtain an API key from https://context7.com/dashboard
2. Set the environment variable
3. Restart Cline
4. Use the tools in your prompts by adding "use context7" at the end

## Server Capabilities

- ✅ Install directory created: `/home/tbaltzakis/Cline/MCP/context7/`
- ✅ Package installed: `@upstash/context7-mcp` v3.2.4
- ✅ Configuration added to cline_mcp_settings.json
- ✅ Server help verified working
- ✅ Two tools available: `resolve-library-id` and `query-docs`

## Pending: Full Tool Demonstration

To demonstrate the actual tools working, the Context7 API key must be:
1. Obtained from https://context7.com/dashboard
2. Set as environment variable: `CONTEXT7_API_KEY`
3. Cline restarted to load the configuration
4. Tools used in actual queries