# `n8n`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `n8n` |
| Resource name | `n8n` |
| Hostname / DNS | n8n.cloudless.gr |
| Ports | 5678 · NodePort 30900 |
| Role | Workflow automation (SQLite on PVC). |

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
