# MCP Manager Bridge

This workspace supports the MCP Manager Bridge VS Code extension, allowing VS Code to connect to the MCP Manager desktop application and keep workspace MCP configuration in sync.

## What it does

- Connects VS Code to MCP Manager via HTTP/WebSocket.
- Shows configured MCP servers in a dedicated panel.
- Allows enable/disable and restart of servers from inside VS Code.
- Syncs Project MCP configuration to Cursor `mcp.json` config.

## Supported servers in this workspace

This repository includes the following MCP servers in `mcp.json`, `.mcp.json`, and `project.mcp.json`:

- `project` — launches `project-mcp`
- `mcp-tool-shop` — launches `mcp-tool-shop`
- `codeglide-mcp-server` — launches the CodeGlide MCP server via Docker

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

- `codeglide-mcp-server` uses `bash` and Docker. Windows users should run VS Code from WSL or adjust the command to their shell environment.
- If the extension detects this workspace config, it should be able to launch the selected server by name.
