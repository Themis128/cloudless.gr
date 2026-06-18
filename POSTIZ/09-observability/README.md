# Observability — metrics, logs, dashboards, alerts

| Piece | What it gives you | URL after install |
|---|---|---|
| **kube-prometheus-stack** | Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics | https://grafana.cloudless.gr |
| **Loki + Alloy** | Logs from every pod, queryable via Grafana | (datasource only; query via Grafana) |
| **Pre-wired dashboards** | Postiz, CNPG, Redis, MinIO, n8n, ArgoCD, K8s overview | auto-loaded in Grafana sidebar |
| **PrometheusRule alerts** | PG down, backup failure, MinIO down, cert expiring, pod crashloop | Alertmanager UI behind Grafana |

Everything is sized for K3s single-node. Bump replica counts / retention for multi-node clusters.

## Install

```bash
chmod +x install-observability.sh
./install-observability.sh
```

Then:
- Grafana initial password: `kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d`
- Username: `admin`
- Pre-wired dashboards appear under the **Postiz** folder in the left sidebar

## Layout

```
09-observability/
├── kube-prometheus-stack/
│   ├── values.yaml                 # Prometheus + Alertmanager + Grafana
│   └── ingress.yaml                # grafana.cloudless.gr
├── loki/
│   └── values.yaml                 # Loki single-binary + Alloy log collector
├── enable-metrics/
│   ├── cnpg-cluster-patch.yaml     # flips monitoring.enablePodMonitor=true
│   └── redis-values-override.yaml  # turns Bitnami Redis metrics exporter on
├── dashboards/
│   ├── postiz.yaml                 # custom Postiz overview
│   ├── cnpg.yaml                   # community: CloudNativePG cluster (id 20417)
│   ├── redis.yaml                  # community: Redis Dashboard (id 11835)
│   ├── minio.yaml                  # community: MinIO Cluster (id 13502)
│   ├── argocd.yaml                 # community: ArgoCD (id 14584)
│   └── n8n.yaml                    # community: n8n
└── alerts/
    └── prometheusrule.yaml         # critical alerts
```

## What gets scraped

| Target | Source of metrics | Scraped via |
|---|---|---|
| Postiz app | Node.js process metrics | (not exposed — only logs go to Loki) |
| CloudNativePG cluster | barman + postgres exporter | PodMonitor (auto-discovered after patch) |
| Redis | bitnami/redis-exporter sidecar | ServiceMonitor (chart-managed) |
| MinIO | built-in /minio/v2/metrics/cluster | annotations on Tenant pods |
| n8n | n8n metrics endpoint (`N8N_METRICS=true`) | ServiceMonitor (manual) |
| ArgoCD | server, repo-server, application-controller | ServiceMonitor (chart-managed) |
| Traefik | built-in /metrics | already scraped by K3s default config |
| Kubernetes | node + apiserver + kubelet + cAdvisor | kube-prometheus-stack default |

## Retention

- **Prometheus:** 15d, 20 GiB cap. Beyond that, ship to Mimir/Thanos.
- **Loki:** 7d. Cheap to bump — increase `limits_config.retention_period` in `loki/values.yaml`.
- **Alertmanager silences:** 5d.

## Alerts go where?

Out of the box they fire to the Alertmanager UI only. Edit `alerts/prometheusrule.yaml` + the chart's `alertmanager.config.receivers` to wire Slack/Discord/email/Pushover.
