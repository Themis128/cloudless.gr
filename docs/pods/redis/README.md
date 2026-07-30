# `redis`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `redis` |
| Hostname / DNS | (ClusterIP — forward `127.0.0.1:16379`) |
| Ports | 6379 |
| Role | Redis 7 cache/queue for AppFlowy. |

## How cloudless.gr uses it

**Not used by Next.js.** Ephemeral (no PVC). Required for AppFlowy Cloud/worker.

## Key files

- `docs/databases/omv-cluster.md`

## Secrets / config

- none in app SSM

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`appflowy-worker`](../appflowy-worker/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
