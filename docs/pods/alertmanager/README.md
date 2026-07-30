# `alertmanager-kube-prom-kube-prometheus-alertmanager`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | StatefulSet |
| Namespace | `monitoring` |
| Resource name | `alertmanager-kube-prom-kube-prometheus-alertmanager` |
| Hostname / DNS | ClusterIP 9093 |
| Ports | 9093 |
| Role | Alertmanager — routes Prometheus alerts. |

## How cloudless.gr uses it

No direct Next client. Fires into **pi-alert-api** / Slack / MQTT on the
ops path. High severity can POST `/api/webhooks/admin-alert` on the app.

## Key files

- `infrastructure/monitoring/`
- `src/app/api/webhooks/admin-alert/route.ts`

## Secrets / config

- receiver configs in monitoring Helm values

## Related workloads

- [`prometheus`](../prometheus/)
- [`pi-alert-api`](../pi-alert-api/)
- [`ntfy`](../ntfy/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
