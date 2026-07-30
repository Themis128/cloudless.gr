# `ingress`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | StatefulSet |
| Namespace | `tailscale` |
| Resource name | `ingress` |
| Hostname / DNS | Tailscale Serve (e.g. grafana.*.ts.net) |
| Ports | ProxyGroup ingress |
| Role | Tailscale ProxyGroup for HTTP Serve to cluster Services. |

## How cloudless.gr uses it

Optional private admin URLs over Tailscale. Not used by public customers;
operators may open Grafana/Meili via Serve instead of CF Access.

## Key files

- `docs/cluster/TAILSCALE-FABRIC.md`
- `infrastructure/tailscale/`

## Secrets / config

- operator-managed

## Related workloads

- [`operator`](../operator/)
- [`kube-prom-grafana`](../kube-prom-grafana/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
