# `ntfy`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `ntfy` |
| Resource name | `ntfy` |
| Hostname / DNS | ntfy.cloudless.gr |
| Ports | 80 · NodePort 30080 |
| Role | Push notification server (phone alerts). |

## How cloudless.gr uses it

Optional admin push via `src/lib/ntfy.ts` when `ADMIN_PUSH_VIA_NTFY=1`
(`notifyAdmin` / admin-alert webhook). Also used by Kuma bootstrap as an
ntfy notification channel.

## Key files

- `src/lib/ntfy.ts`
- `src/lib/admin-alerts.ts`
- `src/app/api/webhooks/admin-alert/route.ts`
- `infrastructure/ntfy/`

## Secrets / config

- `NTFY_BASE_URL`
- `NTFY_TOPIC`
- `NTFY_TOKEN`
- `ADMIN_PUSH_VIA_NTFY`

## Related workloads

- [`cloudless-app`](../cloudless-app/)
- [`uptime-kuma`](../uptime-kuma/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
