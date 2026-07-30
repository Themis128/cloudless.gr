# `prometheus-kube-prom-kube-prometheus-prometheus`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | StatefulSet |
| Namespace | `monitoring` |
| Resource name | `prometheus-kube-prom-kube-prometheus-prometheus` |
| Hostname / DNS | `…prometheus.monitoring.svc:9090` (ClusterIP) |
| Ports | 9090 |
| Role | Prometheus TSDB + scrape targets. |

## How cloudless.gr uses it

Next.js does not scrape Prometheus directly. Grafana datasources point here;
admin PromQL goes through Grafana. Node/kube metrics feed cluster SLO dashboards.

## Key files

- `infrastructure/monitoring/`
- `src/lib/grafana.ts` (datasource sync)

## Secrets / config

- none in app; scrape configs via Helm values

## Related workloads

- [`kube-prom-grafana`](../kube-prom-grafana/)
- [`kube-prom-prometheus-node-exporter`](../kube-prom-prometheus-node-exporter/)
- [`kube-prom-kube-state-metrics`](../kube-prom-kube-state-metrics/)
- [`alertmanager`](../alertmanager/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
