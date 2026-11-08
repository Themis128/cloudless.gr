# `kube-prom-prometheus-node-exporter`
> **Historical (pre-2026-08-08).** omv-ha was removed from the k3s cluster on 2026-08-08 and is now a dedicated mail host — it is not a cluster node. Kept for reference — do not follow as current ops.


> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | DaemonSet |
| Namespace | `monitoring` |
| Resource name | `kube-prom-prometheus-node-exporter` |
| Hostname / DNS | (per-node) |
| Ports | 9100 (host) |
| Role | Node CPU/disk/RAM exporters on omv + omv-ha. |

## How cloudless.gr uses it

**Ops-only.** Disk/RAM panels in Grafana; also informs omv-disk-watchdog
ops story. App does not scrape it.

## Key files

- `infrastructure/monitoring/`
- omv-disk-watchdog CronJob

## Secrets / config

- none

## Related workloads

- [`prometheus`](../prometheus/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
