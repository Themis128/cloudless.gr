# `kube-prom-kube-prometheus-operator`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `monitoring` |
| Resource name | `kube-prom-kube-prometheus-operator` |
| Hostname / DNS | (internal) |
| Ports | n/a |
| Role | Prometheus Operator — manages Prometheus/Alertmanager CRs. |

## How cloudless.gr uses it

**Ops-only.** Not called by Next.js. Keep healthy so Grafana datasources and
alert rules stay reconciled.

## Key files

- `infrastructure/monitoring/`

## Secrets / config

- none in app

## Related workloads

- [`prometheus`](../prometheus/)
- [`alertmanager`](../alertmanager/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
