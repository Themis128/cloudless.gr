# `cloudless-app`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `cloudless` |
| Resource name | `cloudless-app` |
| Hostname / DNS | cloudless.gr · manage.cloudless.gr · pi-origin.cloudless.gr |
| Ports | NodePort 30300 (HTTP) |
| Role | Primary Next.js application (this repo). |

## How cloudless.gr uses it

This **is** the cloudless.gr product. The Pi image is built by `deploy-pi.yml`,
pushed to ECR, and rolled out here. All peer services below are called from this
pod via HTTPS (public `*.cloudless.gr`) or in-cluster DNS (`*.svc.cluster.local`).
Admin cluster UI reads CronJobs through the in-pod ServiceAccount (`k8s-cluster.ts`).

## Key files

- `src/**`
- `src/lib/k8s-cluster.ts`
- `src/app/api/admin/cluster/**`
- `k8s/cloudless-app-hostpath.yaml`

## Secrets / config

- k8s `cloudless-secrets`
- Cloudflare D1 `app_config` table (runtime secrets via `set-d1-config.yml`)
- build-time `NEXT_PUBLIC_*`

## Related workloads

- [`meilisearch`](../meilisearch/)
- [`espocrm`](../espocrm/)
- [`appflowy-cloud`](../appflowy-cloud/)
- [`postiz`](../postiz/)
- [`n8n`](../n8n/)
- [`uptime-kuma`](../uptime-kuma/)
- [`kube-prom-grafana`](../kube-prom-grafana/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
