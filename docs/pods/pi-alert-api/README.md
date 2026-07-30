# `alert-api`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `alert-manager` |
| Resource name | `alert-api` |
| Hostname / DNS | logs.cloudless.gr · LAN `192.168.1.128:30820` · in-cluster `alert-api.alert-manager.svc:8080` |
| Ports | 8080 / NodePort **30820** (not 30800 — reserved for omv-ai) |
| Role | ESP32 / homelab alert API + websocket logs. |
| Manifest | `infrastructure/pi-alert-api/k8s/alert-api.yaml` |

## How cloudless.gr uses it

Admin ESP32 + ops monitor routes proxy here. Alertmanager / MQTT may fan
into `/api/webhooks/admin-alert`. Not on the store/checkout path.

## Key files

- `src/app/api/admin/esp32/**`
- `src/app/api/admin/ops/monitor/route.ts`
- `infrastructure/pi-alert-api/`

## Secrets / config

- `ALERT_API_URL`
- optional `NEXT_PUBLIC_ALERT_WS_URL`

## Related workloads

- [`alertmanager`](../alertmanager/)
- [`ntfy`](../ntfy/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
