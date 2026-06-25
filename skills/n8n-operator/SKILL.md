---
name: n8n-operator
description: |
  Operate the self-hosted n8n workflow automation engine on the cloudless.gr
  cluster — deploy, manage workflows, wire webhooks, import/export JSON, and
  connect n8n to EspoCRM, Postiz, Slack, Resend, and AppFlowy. Use whenever
  the user mentions "n8n", "automation workflow", "webhook trigger", "n8n
  workflow", "n8n.cloudless.gr", or asks to automate a multi-step process
  between any two services in the stack.
---

# n8n — operations skill

n8n is a self-hosted workflow automation engine running on omv-main (Pi 5)
at `https://n8n.cloudless.gr`. It connects all cloudless.gr services
without custom code: EspoCRM → Slack, Postiz → UTM attribution, AppFlowy
→ newsletter, etc.

## Architecture

```
Cloudflare DNS
└─ n8n.cloudless.gr (CNAME → cloudflared tunnel)
   └─ cloudflared on omv-main
      └─ http://192.168.1.128:30900 → NodePort 30900 → pod 5678

k3s namespace: n8n
  Deployment: n8n (n8nio/n8n:latest, pinned to omv node)
  PVC: n8n-data 5Gi (local-path → sda1)
  Storage: SQLite (single writer, Recreate strategy)
  RAM: 200Mi request / 768Mi limit (peaks ~350-450Mi at boot during migrations)
```

## Where things live

| Concern | Path |
|---|---|
| k8s manifest | `infrastructure/n8n/k8s.yaml` |
| Cloudflare tunnel rule | `infrastructure/n8n/cloudflare-tunnel.yaml` |
| LimitRange (prevents OOM eviction) | `infrastructure/n8n/limitrange.yaml` |
| Workflow JSON exports | `infrastructure/n8n/workflows/` |

## Common ops

### Deploy / redeploy

```bash
kubectl apply -f infrastructure/n8n/limitrange.yaml
kubectl apply -f infrastructure/n8n/k8s.yaml
kubectl -n n8n rollout status deploy/n8n --timeout=120s
```

### Tail logs

```bash
kubectl -n n8n logs deploy/n8n -f --tail=200
```

Via MCP (Cowork sessions):
`mcp__cloudless-infra__k3s_get_pod_logs({ namespace: "n8n", deployment: "n8n" })`

### Restart

```bash
kubectl -n n8n rollout restart deploy/n8n
kubectl -n n8n rollout status  deploy/n8n --timeout=120s
```

### Verify n8n is up

```bash
curl -s https://n8n.cloudless.gr/healthz   # → {"status":"ok"}
```

## Importing a workflow

1. Open `https://n8n.cloudless.gr` in a browser.
2. **Workflows → Import from file** → pick the JSON from `infrastructure/n8n/workflows/`.
3. Activate the workflow (toggle top-right).
4. Copy the webhook URL shown in the Webhook node — it looks like
   `https://n8n.cloudless.gr/webhook/<path>`.

To import via API (no UI access):

```bash
N8N_API_KEY="<from n8n UI → Settings → API → Create API Key>"
curl -X POST https://n8n.cloudless.gr/api/v1/workflows \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @infrastructure/n8n/workflows/<workflow>.json
```

## Exporting a workflow

```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://n8n.cloudless.gr/api/v1/workflows | jq
# Then export a specific one:
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://n8n.cloudless.gr/api/v1/workflows/<id> > infrastructure/n8n/workflows/<name>.json
```

Always commit exported JSONs to `infrastructure/n8n/workflows/` so they survive
a pod restart (SQLite PVC is the live store but is not backed up independently).

## Workflows in this repo

| File | Trigger | What it does |
|------|---------|--------------|
| `lead-enrich.json` | EspoCRM webhook (Contact created) | Enriches the lead with Clearbit/Hunter, updates EspoCRM fields, posts to `#contacts` |
| `newsletter-nurture.json` | Webhook `newsletter-nurture` | Adds subscriber to Resend audience, sends welcome email sequence |
| `postiz-utm-guard.json` | Postiz webhook (post published) | Checks published post URL for UTM params; alerts `#campaigns` if missing |
| `contact-to-campaigns.json` | Webhook from contact/route.ts | Dual-posts paid-social leads to `#campaigns` with full Block Kit card |

## Connecting to services

### EspoCRM

- Base URL: `https://espocrm.cloudless.gr`
- Auth: HTTP Header → `X-Api-Key: <ESPOCRM_API_KEY>` (from SSM `/cloudless/production/ESPOCRM_API_KEY`)
- n8n credential type: **HTTP Header Auth**

### Postiz

- Base URL: `https://postiz.cloudless.gr/api/public/v1`
- Auth: HTTP Header → `Authorization: <POSTIZ_API_KEY>` (from SSM `/cloudless/production/POSTIZ_API_KEY`)
- n8n credential type: **HTTP Header Auth**

### Slack

- Auth: Bot token (from SSM `/cloudless/production/SLACK_BOT_TOKEN`)
- n8n credential type: **Slack OAuth2 API** or **HTTP Header Auth** with `Authorization: Bearer <token>`
- Use the HTTP Request node pointed at `https://slack.com/api/chat.postMessage` — avoids the n8n Slack
  credential OAuth dance for a bot token you already have.

### Resend (email)

- Auth: HTTP Header → `Authorization: Bearer <RESEND_API_KEY>`
- Endpoint: `https://api.resend.com/emails`

### AppFlowy

- Auth: `POST https://appflowy.cloudless.gr/gotrue/token?grant_type=password` with email + password → `access_token`
- n8n pattern: use a **Set** node to store the token, then HTTP Request nodes with `Authorization: Bearer <token>`

## SSM secret pattern in n8n

n8n does not natively read AWS SSM. Two options:

**Option A (recommended):** Store secrets as n8n credentials (once, manually via UI). n8n encrypts them in SQLite. Reference via the credential selector in HTTP Request nodes.

**Option B:** Use an HTTP Request node to call the AWS SSM Parameter Store API with SigV4 signing. Complex — prefer Option A.

## Webhook security

n8n webhook URLs are public (behind Cloudflare, no auth by default). Add a
shared secret:

1. In the Webhook node → **Authentication → Header Auth**.
2. Header name: `X-Webhook-Secret`, value: a random string you store in SSM.
3. The caller (Postiz, EspoCRM, cloudless.gr) must send that header.

## Known quirks

- **SQLite single-writer**: never run more than one n8n replica. `strategy: Recreate` in the manifest enforces this.
- **Boot migrations**: n8n runs DB migrations on every start — the first 60s after a restart the UI may return 503. Wait for the healthz endpoint.
- **Pinned to omv node**: the `nodeSelector: kubernetes.io/hostname: omv` in `k8s.yaml` keeps n8n on the Pi 5. The Pi 4 (omv-ha) only has 1GB RAM — n8n won't start there.
- **Workflow activation survives restart**: activated workflows are stored in SQLite on the PVC. As long as the PVC is intact, all workflows auto-activate on pod restart.

## Disaster recovery

If the PVC is lost (unlikely — it's on the dedicated SSD), re-import all JSONs from `infrastructure/n8n/workflows/` and re-enter credentials manually. Credentials are not stored in the JSON exports for security reasons.

## Future work (don't do unsolicited)

- Automated credential seeding from SSM on first deploy (init container).
- Prometheus metrics scrape from `/metrics` (n8n exposes them at port 5678 when `N8N_METRICS=true`).
- Workflow backup CronJob alongside the existing Postiz backup.
