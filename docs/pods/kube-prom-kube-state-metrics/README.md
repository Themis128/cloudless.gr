# `kube-prom-kube-state-metrics`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `monitoring` |
| Resource name | `kube-prom-kube-state-metrics` |
| Hostname / DNS | (internal) |
| Ports | 8080 metrics |
| Role | Exports Kubernetes object metrics to Prometheus. |

## How cloudless.gr uses it

**Ops-only.** Feeds Grafana cluster dashboards. No Next.js import.

## Key files

- `infrastructure/monitoring/`

## Secrets / config

- none

## Related workloads

- [`prometheus`](../prometheus/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
