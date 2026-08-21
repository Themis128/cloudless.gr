# Postiz MCP (Cursor)

Live config lives in `~/.cursor/mcp.json` (server name: `postiz`).

## Why Tailscale NodePort?

`https://postiz.cloudless.gr` is behind Cloudflare Access. From WSL on the
tailnet, use:

```text
http://100.74.191.58:30500/api/mcp/<POSTIZ_API_KEY>
```

Verified 2026-08-15: MCP initialize + `integrationList` works on that URL
(9 tools). Public hostname returns Access login 302 without a service token.

## Public hostname (optional)

```json
"postiz-public": {
  "url": "https://postiz.cloudless.gr/api/mcp/${env:POSTIZ_API_KEY}",
  "headers": {
    "CF-Access-Client-Id": "${env:POSTIZ_CF_ACCESS_CLIENT_ID}",
    "CF-Access-Client-Secret": "${env:POSTIZ_SERVICE_TOKEN}"
  }
}
```

Or add a Cloudflare Access bypass for `/api/mcp*` and `/api/public/v1/*`
(Postiz still requires the API key).

## Smoke test

After Cursor Settings → MCP → refresh Postiz:

> List my Postiz connected social accounts

If the Integration table is empty in Postgres, connect channels in the Postiz UI first.
