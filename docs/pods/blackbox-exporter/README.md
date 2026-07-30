# `blackbox-exporter`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `monitoring` |
| Resource name | `blackbox-exporter` |
| Hostname / DNS | (internal) |
| Ports | 9115 |
| Role | Blackbox probe exporter (HTTP/TCP/ICMP). |

## How cloudless.gr uses it

**Ops-only.** Prometheus blackbox module for external URL probes. Complements
Uptime Kuma; no Next.js client.

## Key files

- `infrastructure/monitoring/`

## Secrets / config

- none

## Related workloads

- [`prometheus`](../prometheus/)
- [`uptime-kuma`](../uptime-kuma/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
