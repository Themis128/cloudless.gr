# MCP Manager Bridge

This workspace supports the MCP Manager Bridge VS Code extension, allowing VS Code to connect to the MCP Manager desktop application and keep workspace MCP configuration in sync.

## What it does

- Connects VS Code to MCP Manager via HTTP/WebSocket.
- Shows configured MCP servers in a dedicated panel.
- Allows enable/disable and restart of servers from inside VS Code.
- Syncs Project MCP configuration to Cursor `mcp.json` config.

## Supported servers in this workspace

The MCP configs live at `.cursor/rules/mcp.json` and `.kiro/settings/mcp.json` (per-tool consumers read their own file).

Configured servers:

- `project` — launches `project-mcp`
- `mcp-tool-shop` — launches `mcp-tool-shop`
- `cloudflare-worker` / `cloudflare` — Cloudflare Workers + platform ops

> The `notion` server entry was removed 2026-11-21 — the Notion workspace was decommissioned (CMS is AppFlowy now).

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
