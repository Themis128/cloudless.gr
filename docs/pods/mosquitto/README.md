# `mosquitto`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `monitoring` |
| Resource name | `mosquitto` |
| Hostname / DNS | `mosquitto.monitoring.svc.cluster.local` · NodePort 31883 |
| Ports | 1883 |
| Role | MQTT broker for homelab / ESP32 alerts. |

## How cloudless.gr uses it

Server-side MQTT client (`src/lib/mqtt.ts`): retained alert status for
admin cluster chip; publish webhook; high severity can `notifyAdmin`.
ESP32 / alert-api are primary publishers.

## Key files

- `src/lib/mqtt.ts`
- `src/app/api/admin/cluster/mqtt-status/route.ts`
- `src/app/api/webhooks/mqtt/publish/route.ts`
- `infrastructure/esp32-watchdog/`

## Secrets / config

- `MQTT_BROKER_HOST`
- `MQTT_BROKER_PORT`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`

## Related workloads

- [`pi-alert-api`](../pi-alert-api/)
- [`cloudless-app`](../cloudless-app/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
