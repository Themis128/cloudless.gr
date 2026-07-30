# `postiz-redis`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `postiz` |
| Resource name | `postiz-redis` |
| Hostname / DNS | (ClusterIP — forward `127.0.0.1:16380`) |
| Ports | 6379 |
| Role | Redis 7 (AOF) for Postiz queues. |

## How cloudless.gr uses it

**Not used by Next.js.** Required for Postiz job processing.

## Key files

- `docs/databases/omv-cluster.md`

## Secrets / config

- k8s PVC `postiz-redis-data`

## Related workloads

- [`postiz`](../postiz/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
