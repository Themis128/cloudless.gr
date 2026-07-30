# `appflowy-cloud`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `appflowy-cloud` |
| Hostname / DNS | appflowy.cloudless.gr (via nginx) |
| Ports | internal; public via appflowy nginx NodePort 30810 |
| Role | AppFlowy Cloud API — Notion-replacement CMS backend. |

## How cloudless.gr uses it

When AppFlowy is configured, blog/docs/FAQs/services/testimonials/case-studies
adapters prefer AppFlowy over Notion (`cms-provider.ts`). The Next app
authenticates with JWT/email against GoTrue and calls Cloud HTTP APIs —
never Postgres/Redis/MinIO directly.

## Key files

- `src/lib/appflowy.ts`
- `src/lib/appflowy-*.ts`
- `src/lib/cms-provider.ts`
- `src/app/api/admin/appflowy/**`
- `skills/appflowy-operator/SKILL.md`

## Secrets / config

- `APPFLOWY_API_URL`
- `APPFLOWY_JWT_SECRET`
- `APPFLOWY_EMAIL`
- `APPFLOWY_PASSWORD`

## Related workloads

- [`appflowy-web`](../appflowy-web/)
- [`gotrue`](../gotrue/)
- [`postgres`](../postgres/)
- [`redis`](../redis/)
- [`minio`](../minio/)
- [`nginx`](../nginx/)
- [`appflowy-worker`](../appflowy-worker/)
- [`admin-frontend`](../admin-frontend/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
