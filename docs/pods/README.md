# Pods / workloads (omv k3s)

One folder per live Deployment / StatefulSet / DaemonSet (plus host `cloudflared`,
`pi-alert-api`, `mosquitto`). Ephemeral pod names (`…-7d8f9-abcde`) are not documented —
use the stable resource name.

Verified inventory source: `kubectl get deploy,sts,ds -A` on omv (2026-07-30).

> Probe 2026-07-30: `coredns`, `metrics-server`, `traefik` (+ `svclb-traefik`) are Running in `kube-system`. No in-cluster Deployments matched `mosquitto` / `alert-api` / `cloudflared` name patterns — those remain host or external as documented.

## Product / app-coupled

| Folder | NS | App coupling |
|--------|----|--------------|
| [cloudless-app](cloudless-app/) | `cloudless` | Strong / supporting data plane |
| [meilisearch](meilisearch/) | `meilisearch` | Strong / supporting data plane |
| [espocrm](espocrm/) | `espocrm` | Strong / supporting data plane |
| [espocrm-mariadb](espocrm-mariadb/) | `espocrm` | Strong / supporting data plane |
| [appflowy-cloud](appflowy-cloud/) | `appflowy` | Strong / supporting data plane |
| [appflowy-web](appflowy-web/) | `appflowy` | Strong / supporting data plane |
| [appflowy-worker](appflowy-worker/) | `appflowy` | Strong / supporting data plane |
| [admin-frontend](admin-frontend/) | `appflowy` | Strong / supporting data plane |
| [gotrue](gotrue/) | `appflowy` | Strong / supporting data plane |
| [minio](minio/) | `appflowy` | Strong / supporting data plane |
| [nginx](nginx/) | `appflowy` | Strong / supporting data plane |
| [postgres](postgres/) | `appflowy` | Strong / supporting data plane |
| [redis](redis/) | `appflowy` | Strong / supporting data plane |
| [postiz](postiz/) | `postiz` | Strong / supporting data plane |
| [postiz-postgres](postiz-postgres/) | `postiz` | Strong / supporting data plane |
| [postiz-redis](postiz-redis/) | `postiz` | Strong / supporting data plane |
| [n8n](n8n/) | `n8n` | Strong / supporting data plane |

## Admin / ops

| Folder | NS | App coupling |
|--------|----|--------------|
| [uptime-kuma](uptime-kuma/) | `uptime-kuma` | Admin / alerts / observability |
| [kuma-slack-bridge](kuma-slack-bridge/) | `uptime-kuma` | Admin / alerts / observability |
| [ntfy](ntfy/) | `ntfy` | Admin / alerts / observability |
| [kube-prom-grafana](kube-prom-grafana/) | `monitoring` | Admin / alerts / observability |
| [prometheus](prometheus/) | `monitoring` | Admin / alerts / observability |
| [alertmanager](alertmanager/) | `monitoring` | Admin / alerts / observability |
| [kube-prom-kube-prometheus-operator](kube-prom-kube-prometheus-operator/) | `monitoring` | Admin / alerts / observability |
| [kube-prom-kube-state-metrics](kube-prom-kube-state-metrics/) | `monitoring` | Admin / alerts / observability |
| [kube-prom-prometheus-node-exporter](kube-prom-prometheus-node-exporter/) | `monitoring` | Admin / alerts / observability |
| [blackbox-exporter](blackbox-exporter/) | `monitoring` | Admin / alerts / observability |
| [pi-alert-api](pi-alert-api/) | `alert-manager / host` | Admin / alerts / observability |
| [mosquitto](mosquitto/) | `monitoring` | Admin / alerts / observability |

## Platform / ingress / fabric

| Folder | NS | App coupling |
|--------|----|--------------|
| [cloudflared](cloudflared/) | `omv-host` | Ingress or Tailscale fabric |
| [docs-server](docs-server/) | `default` | Ingress or Tailscale fabric |
| [operator](operator/) | `tailscale` | Ingress or Tailscale fabric |
| [ingress](ingress/) | `tailscale` | Ingress or Tailscale fabric |
| [kube](kube/) | `tailscale` | Ingress or Tailscale fabric |
| [ts-k3s-cidrs](ts-k3s-cidrs/) | `tailscale` | Ingress or Tailscale fabric |
| [coredns](coredns/) | `kube-system` | Ingress or Tailscale fabric |
| [metrics-server](metrics-server/) | `kube-system` | Ingress or Tailscale fabric |
| [traefik](traefik/) | `kube-system` | Ingress or Tailscale fabric |

## How to refresh

```bash
ssh omv 'sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get deploy,sts,ds -A'
```

When a new Deployment appears, add `docs/pods/<name>/README.md` using the same
template (Identity · How cloudless.gr uses it · Key files · Secrets · Related).
