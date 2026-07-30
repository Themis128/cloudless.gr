# `uptime-kuma`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `uptime-kuma` |
| Resource name | `uptime-kuma` |
| Hostname / DNS | kuma.cloudless.gr |
| Ports | 3001 · NodePort 32501 |
| Role | Uptime monitors + status page. |

## How cloudless.gr uses it

Ops visibility: `/admin/cluster` status-page summary (`src/lib/kuma.ts`).
Kuma posts DOWN/UP to `/api/webhooks/kuma` → Slack (DNS flaps coalesced).
Not on the customer purchase path.

## Key files

- `src/lib/kuma.ts`
- `src/lib/kuma-dns-coalesce.ts`
- `src/app/api/webhooks/kuma/route.ts`
- `src/app/api/admin/cluster/kuma-status/route.ts`
- `skills/uptime-kuma-operator/SKILL.md`

## Secrets / config

- `KUMA_BASE_URL`
- `KUMA_API_KEY`
- `KUMA_STATUS_PAGE_SLUG`
- webhook `ADMIN_ALERT_SECRET`

## Related workloads

- [`kuma-slack-bridge`](../kuma-slack-bridge/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
