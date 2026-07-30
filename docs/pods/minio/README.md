# `minio`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `minio` |
| Hostname / DNS | (ClusterIP 9000/9001) |
| Ports | 9000 S3 · 9001 console |
| Role | S3-compatible object store for AppFlowy blobs. |

## How cloudless.gr uses it

**Not used by Next.js.** AppFlowy stores uploads here. Daily R2 mirror
via `cronjob-appflowy-minio.yaml`. Operators: port-forward only if debugging.

## Key files

- `infrastructure/backup/cronjob-appflowy-minio.yaml`
- `docs/databases/omv-cluster.md`

## Secrets / config

- `APPFLOWY_S3_*` in `appflowy-secrets`

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`appflowy-worker`](../appflowy-worker/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
