# `kube-prom-grafana`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `monitoring` |
| Resource name | `kube-prom-grafana` |
| Hostname / DNS | grafana.cloudless.gr |
| Ports | 80 · NodePort 30850 |
| Role | Grafana dashboards + PromQL proxy. |

## How cloudless.gr uses it

Admin Grafana API: health, dashboards, datasource sync, Prometheus queries
through Grafana (`src/lib/grafana.ts` + `/api/admin/grafana/**`). CF Access
autologin for operators.

## Key files

- `src/lib/grafana.ts`
- `src/app/api/admin/grafana/**`
- `infrastructure/grafana/`
- `infrastructure/monitoring/`

## Secrets / config

- `GRAFANA_BASE_URL`
- `GRAFANA_API_TOKEN`
- `PROMETHEUS_URL`

## Related workloads

- [`prometheus`](../prometheus/)
- [`alertmanager`](../alertmanager/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
