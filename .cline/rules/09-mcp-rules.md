# MCP Server Rules

## Connected MCP Servers

The project uses the following MCP servers:

### 1. Filesystem Server
- **Command:** `node /home/tbaltzakis/Cline/MCP/filesystem/dist/index.js`
- **Purpose:** File read/write/search operations within allowed directories
- **Allowed directories:** Configured via `list_allowed_directories` tool
- **Key tools:** `read_file`, `write_file`, `edit_file`, `search_files`, `directory_tree`

### 2. Context7 Documentation Server
- **Command:** `node /home/tbaltzakis/Cline/MCP/context7-mcp/packages/mcp/dist/index.js`
- **Purpose:** Query up-to-date documentation and code examples for libraries/frameworks
- **Workflow:** Call `resolve-library-id` first, then `query-docs` with the resolved ID
- **Limit:** Max 3 calls per question

### 3. Browser Tools MCP
- **Command:** `node /home/tbaltzakis/Cline/MCP/browser-tools-mcp/node_modules/@agentdeskai/browser-tools-mcp/dist/mcp-server.js`
- **Purpose:** Browser automation, console logs, screenshots, audits
- **Key tools:** `takeScreenshot`, `getConsoleLogs`, `getConsoleErrors`, `runAccessibilityAudit`, `runPerformanceAudit`

### 4. Sequential Thinking MCP
- **Command:** `node /home/tbaltzakis/Cline/MCP/sequentialthinking/src/sequentialthinking/dist/index.js`
- **Purpose:** Dynamic and reflective problem-solving through structured thoughts
- **Use when:** Breaking down complex problems, planning with room for revision, multi-step solutions

### 5. Playwright MCP
- **Command:** `npx -y @executeautomation/playwright-mcp-server`
- **Purpose:** Browser automation for E2E testing, form filling, navigation
- **Key tools:** `playwright_navigate`, `playwright_click`, `playwright_fill`, `playwright_screenshot`

## MCP Configuration

- **Config file:** `.cline/mcp.json` (project-level)
- **Global config:** `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- **Format:** JSON with `mcpServers` key containing server definitions

## MCP Server Best Practices

1. **One operation at a time:** Wait for confirmation before proceeding with next MCP call
2. **Check limits:** Respect per-question call limits (e.g., Context7 max 3 calls)
3. **Error handling:** If an MCP server fails, check the server logs and configuration
4. **Security:** MCP servers run locally with filesystem access — keep configurations secure
5. **Debugging:** Use `test-mcp-servers.sh` script to verify server connectivity