# `n8n`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Kind           | Docker container (dev box compose stack `social-automation`)  |
| Namespace      | — (Docker Desktop on office dev box)                          |
| Resource name  | `n8n`                                                         |
| Hostname / DNS | n8n.cloudless.gr (Cloudflare Access-gated)                    |
| Ports          | 5678                                                          |
| Role           | Workflow automation (Postgres `n8n` DB on `social-postgres`). |

> **2026-10-25:** the k3s `n8n` Deployment (NodePort 30900, SQLite on PVC) is
> scaled to 0 — the live n8n runs in the `cu130-slim` docker-compose stack on
> the dev box. The tunnel ingress still routes `n8n.cloudless.gr` to
> `192.168.1.128:30900`, so the public URL currently has no backend. The
> k8s manifests under `infrastructure/n8n/` are kept for reference.

## How cloudless.gr uses it

Admin list/trigger/health/executions via `src/lib/n8n.ts`. Product hooks:
lead enrich + newsletter nurture workflows triggered from EspoCRM/subscribe
paths (`/api/webhooks/n8n/trigger`). CF Access + admin autologin.

## Key files

- `src/lib/n8n.ts`
- `src/app/api/admin/n8n/**`
- `src/app/api/webhooks/n8n/trigger/route.ts`
- `infrastructure/n8n/`

## Secrets / config

- `N8N_API_URL`
- `N8N_API_KEY`
- `N8N_WORKFLOW_LEAD_ENRICH_ID`
- `N8N_WORKFLOW_NEWSLETTER_NURTURE_ID`

## Related workloads

- [`espocrm`](../espocrm/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
