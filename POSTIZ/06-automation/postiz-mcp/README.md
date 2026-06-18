# Postiz MCP — connecting AI clients

Postiz includes a built-in MCP server (8 tools). No separate Deployment is required.

## Endpoints (your instance)

| Auth style | URL |
|---|---|
| Bearer header (recommended) | `https://postiz.cloudless.gr/mcp` |
| API key in URL | `https://postiz.cloudless.gr/mcp/<API_KEY>` |
| OAuth-protected | `https://postiz.cloudless.gr/mcp-oauth` |

## Claude Desktop config

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) — add:

```json
{
  "mcpServers": {
    "postiz": {
      "transport": {
        "type": "http",
        "url": "https://postiz.cloudless.gr/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_POSTIZ_API_KEY"
        }
      }
    }
  }
}
```

Restart Claude Desktop. You'll see `integrationList`, `schedulePostTool`, etc. appear in the tools list.

## Cursor config

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postiz": {
      "url": "https://postiz.cloudless.gr/mcp/YOUR_POSTIZ_API_KEY"
    }
  }
}
```

## Cowork / agent-mode (this project) config

Already covered by the project instructions in this folder — Cowork's Postiz plugin uses the same `/mcp` endpoint.

## Quick test

```bash
curl -X POST https://postiz.cloudless.gr/mcp \
  -H "Authorization: Bearer YOUR_POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expect a JSON-RPC response listing 8 tools.

## Tools exposed

| Tool | Use |
|---|---|
| `integrationList` | List connected channels |
| `integrationSchema` | Per-platform posting rules |
| `triggerTool` | Helpers like Reddit flairs, Discord channels |
| `schedulePostTool` | Schedule / draft / publish |
| `generateImageTool` | AI image gen |
| `generateVideoOptions` | List video options |
| `videoFunctionTool` | Video generator settings (voices etc.) |
| `generateVideoTool` | AI video gen |

## Cloudflare gotcha

If MCP requests hang or return truncated responses, Cloudflare proxy may be stripping `Transfer-Encoding: chunked`. Either:
- Set the `postiz.cloudless.gr` DNS record to **DNS only** (grey cloud, proxy off), or
- Create a Cloudflare cache rule that bypasses cache for `/mcp*`.
