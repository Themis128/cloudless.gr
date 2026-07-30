# `espocrm-mariadb`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `espocrm` |
| Resource name | `espocrm-mariadb` |
| Hostname / DNS | (ClusterIP only — no public hostname) |
| Ports | 3306 → local forward `127.0.0.1:13306` |
| Role | MariaDB 11 backing EspoCRM. |

## How cloudless.gr uses it

**Not used directly by Next.js.** EspoCRM pods talk to this Service.
Operators use `pnpm db:forward` + SQLTools (`omv · EspoCRM MariaDB`).
Daily R2 backup via `mariadb-dump` CronJob.

## Key files

- `docs/databases/omv-cluster.md`
- `infrastructure/espocrm/`
- `infrastructure/backup/cronjob-espocrm.yaml`

## Secrets / config

- k8s `espocrm-secrets` (DB passwords) — never in app SSM

## Related workloads

- [`espocrm`](../espocrm/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
