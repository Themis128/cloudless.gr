# MCP Manager Bridge

This workspace supports the MCP Manager Bridge VS Code extension, allowing VS Code to connect to the MCP Manager desktop application and keep workspace MCP configuration in sync.

## What it does

- Connects VS Code to MCP Manager via HTTP/WebSocket.
- Shows configured MCP servers in a dedicated panel.
- Allows enable/disable and restart of servers from inside VS Code.
- Syncs Project MCP configuration to Cursor `mcp.json` config.

## Supported servers in this workspace

The canonical config is `mcp.json`. The files `.mcp.json` and `project.mcp.json` are symlinks to it, so all consumers read the same configuration.

Configured servers:

- `project` — launches `project-mcp`
- `mcp-tool-shop` — launches `mcp-tool-shop`
- `notion` — launches `@notionhq/notion-mcp-server` (official Notion MCP); reads `NOTION_API_KEY` from the environment via `OPENAPI_MCP_HEADERS`

## Setup

1. Install the MCP Manager desktop application.
2. Install the MCP Manager Bridge extension in VS Code.
3. Open the `cloudless.gr` workspace.
4. Open the MCP Manager Bridge or Project MCP panel.
5. Launch one of the configured servers.

## Cursor sync paths

- macOS / Linux: `~/.cursor/mcp.json`
- Windows: `%APPDATA%\Cursor\mcp.json`

## Notes

- The `notion` server requires `NOTION_API_KEY` to be set in the environment. The `OPENAPI_MCP_HEADERS` value in `mcp.json` interpolates `${NOTION_API_KEY}` at launch time.
- If the extension detects this workspace config, it should be able to launch the selected server by name.
