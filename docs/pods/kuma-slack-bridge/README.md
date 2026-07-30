# `kuma-slack-bridge`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `uptime-kuma` |
| Resource name | `kuma-slack-bridge` |
| Hostname / DNS | `kuma-slack-bridge.uptime-kuma.svc:8080` (optional) |
| Ports | 8080 |
| Role | Optional in-cluster Kuma→Slack bridge (usually replicas: 0). |

## How cloudless.gr uses it

Rollback path if `cloudless-app` `/api/webhooks/kuma` is unavailable.
Live path prefers the app webhook. Scale to 1 only for emergency.

## Key files

- `infrastructure/uptime-kuma/k8s/kuma-slack-bridge.yaml`
- `infrastructure/uptime-kuma/k8s/kuma-slack-bridge.js`

## Secrets / config

- k8s Secret `kuma-slack-bridge` (`ADMIN_ALERT_SECRET`, `SLACK_BOT_TOKEN`)

## Related workloads

- [`uptime-kuma`](../uptime-kuma/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
