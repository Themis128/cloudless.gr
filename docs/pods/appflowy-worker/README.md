# `appflowy-worker`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `appflowy-worker` |
| Hostname / DNS | (internal) |
| Ports | n/a |
| Role | AppFlowy background worker (must stay on a 4 KiB-page node — pin to omv-ha). |

## How cloudless.gr uses it

No direct Next.js calls. Required for AppFlowy Cloud jobs (email, indexing).
If this pod is down, CMS writes may stall; public site reads can still serve
cached/API data until Cloud fails.

## Key files

- `skills/appflowy-operator/SKILL.md`
- `docs/self-hosted/appflowy-deploy.md`

## Secrets / config

- shared `appflowy-secrets`

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`postgres`](../postgres/)
- [`redis`](../redis/)
- [`minio`](../minio/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
