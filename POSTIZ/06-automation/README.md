# Automation Layer

Three pieces, all driven by a single Postiz API key.

| Piece | What it gives you | Where it lives |
|---|---|---|
| **Postiz MCP** | Lets Claude / ChatGPT / Cursor schedule posts via natural language | Built into the Postiz app — no separate Deployment |
| **Postiz Agent CronJob** | Scheduled CLI tasks (daily content rotation, weekly reports, etc.) | `postiz-agent/cronjob.yaml` |
| **n8n + postiz-n8n** | Visual workflows that fan out to Postiz | `n8n/` (8gears Helm chart + community node) |

## 0. Mint a Postiz API key (do this first)

1. Open https://postiz.cloudless.gr
2. **Settings → Developers → Public API → Generate API key**
3. Stash it — you'll paste it into:
   - `postiz-agent/secret.yaml`
   - `n8n` (configured per-credential inside n8n's UI)
   - Your local Claude Desktop / Cursor MCP client config

## 1. Postiz MCP (zero-deploy)

Postiz exposes 8 MCP tools (`integrationList`, `schedulePostTool`, `generateImageTool`, etc.) at:

```
https://postiz.cloudless.gr/mcp        # Bearer auth
https://postiz.cloudless.gr/mcp/<API_KEY>   # key in URL
```

See `postiz-mcp/README.md` for client examples (Claude Desktop, Cursor, OpenAI agents).

Traefik forwards chunked / streaming HTTP by default, so the existing Ingress already works. Only thing to verify is that Cloudflare doesn't strip `Transfer-Encoding: chunked` — set the affected DNS record to **DNS only** (proxy off) if MCP streams hang.

## 2. Postiz Agent CronJob

```bash
kubectl apply -f postiz-agent/secret.yaml      # filled, not the .example
kubectl apply -f postiz-agent/cronjob.yaml
```

Schedule and command live in `cronjob.yaml` — edit the `schedule:` and `args:` to whatever recurring CLI task you want. Default sample: daily 09:00 UTC list of next-7-days posts to logs.

## 3. n8n with postiz custom node

```bash
helm repo add open-8gears https://8gears.container-registry.com/chartrepo/library
helm upgrade --install n8n open-8gears/n8n \
  --namespace n8n --create-namespace \
  -f n8n/values.yaml
kubectl apply -f n8n/ingress.yaml
```

After it's up at https://n8n.cloudless.gr:
1. Create the admin user
2. **Settings → Community Nodes → Install** → enter `n8n-nodes-postiz`
3. In any workflow, add a **Postiz** node and configure credentials with your API key and base URL `https://postiz.cloudless.gr/api`

Note the `/api` suffix — required when self-hosting (per the postiz-n8n README).
