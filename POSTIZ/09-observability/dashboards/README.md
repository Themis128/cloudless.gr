# Grafana dashboards (auto-loaded)

The Grafana sidecar watches every namespace for `ConfigMap` resources labelled
`grafana_dashboard: "1"` and imports them. We use it to ship a curated set
without manually clicking through the import flow.

## What gets loaded

| File | Dashboard | Source |
|---|---|---|
| `cnpg.yaml` | CloudNativePG Cluster overview | community ID 20417 |
| `redis.yaml` | Redis Dashboard (bitnami exporter) | community ID 11835 |
| `minio.yaml` | MinIO Cluster overview | community ID 13502 |
| `argocd.yaml` | ArgoCD Operational Overview | community ID 14584 |
| `n8n.yaml` | n8n Workflow Executions | community ID 11159 |
| `postiz.yaml` | Custom Postiz overview (queues, http, cron) | hand-rolled |

## How the chart-as-CM pattern works

Each `.yaml` file is a `ConfigMap` with the JSON dashboard inlined under `data:`. To regenerate one from the latest community version:

```bash
# Example: refresh CNPG dashboard
ID=20417
REV=$(curl -s https://grafana.com/api/dashboards/$ID | jq '.revision')
JSON=$(curl -s https://grafana.com/api/dashboards/$ID/revisions/$REV/download)
# Wrap in a ConfigMap manually or with kubectl create cm --dry-run=client -o yaml
```

The installer script `download-dashboards.sh` does this for you across all listed IDs in one pass.

## Folder organisation in Grafana

All dashboards land in a **Postiz Platform** folder so they don't pollute the default folder. This is set via the ConfigMap annotation `grafana_folder: "Postiz Platform"` (the sidecar's `foldersFromFilesStructure` reads it).
