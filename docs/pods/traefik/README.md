# `traefik`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `kube-system` |
| Resource name | `traefik` |
| Hostname / DNS | LAN Traefik UI / IngressRoute (e.g. :18080 / :18443) |
| Ports | 80/443 + svclb DaemonSet on both nodes |
| Role | k3s ingress controller + ServiceLB (`svclb-traefik-*`). |

## How cloudless.gr uses it

**Ops / LAN path.** Public traffic for cloudless.gr is primarily
**Cloudflare Tunnel → NodePort**, not Traefik. Some IngressRoutes (Grafana,
Postiz) may still use Traefik on the LAN. Next.js does not call Traefik APIs.

## Key files

- `infrastructure/monitoring/grafana-ingressroute.yaml`
- `infrastructure/postiz/k8s/ingressroute.yaml`
- `docs/pods/cloudflared/`

## Secrets / config

- none in app

## Related workloads

- [`cloudflared`](../cloudflared/)
- [`kube-prom-grafana`](../kube-prom-grafana/)
- [`coredns`](../coredns/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
