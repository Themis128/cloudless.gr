# `postgres`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `postgres` |
| Hostname / DNS | (ClusterIP — forward `127.0.0.1:15432`) |
| Ports | 5432 |
| Role | Postgres 16 + pgvector for AppFlowy. |

## How cloudless.gr uses it

**Not used by Next.js.** SQLTools connection `omv · AppFlowy Postgres`.
Daily `pg_dump` → R2. WAL-G sidecar may mirror to R2.

## Key files

- `docs/databases/omv-cluster.md`
- `infrastructure/backup/cronjob-appflowy.yaml`

## Secrets / config

- `POSTGRES_PASSWORD` in `appflowy-secrets`

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`appflowy-worker`](../appflowy-worker/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
