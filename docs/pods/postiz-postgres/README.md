# `postiz-postgres`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `postiz` |
| Resource name | `postiz-postgres` |
| Hostname / DNS | (ClusterIP — forward `127.0.0.1:15433`) |
| Ports | 5432 |
| Role | Postgres 17 for Postiz. |

## How cloudless.gr uses it

**Not used by Next.js.** SQLTools `omv · Postiz Postgres`. Daily `pg_dump` → R2.

## Key files

- `docs/databases/omv-cluster.md`
- `infrastructure/backup/cronjob-postiz.yaml`

## Secrets / config

- k8s `postiz-secrets`

## Related workloads

- [`postiz`](../postiz/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
