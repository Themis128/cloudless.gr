# `metrics-server`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `kube-system` |
| Resource name | `metrics-server` |
| Hostname / DNS | metrics.k8s.io API |
| Ports | 443 (API aggregation) |
| Role | Provides `kubectl top` / HPA metrics. |

## How cloudless.gr uses it

**Ops-only.** Not imported by Next.js. When it has no endpoints,
`kubectl top` and some controllers warn; product HTTP is unaffected.

## Key files

- k3s bundled metrics-server

## Secrets / config

- none

## Related workloads

- [`coredns`](../coredns/)
- [`traefik`](../traefik/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
