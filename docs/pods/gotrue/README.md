# `gotrue`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `gotrue` |
| Hostname / DNS | (internal to AppFlowy) |
| Ports | internal |
| Role | GoTrue auth for AppFlowy (JWT issuer). |

## How cloudless.gr uses it

The Next app obtains JWTs using `APPFLOWY_EMAIL` / `APPFLOWY_PASSWORD`
against this service (through AppFlowy API URL). No separate public hostname.

## Key files

- `src/lib/appflowy.ts`

## Secrets / config

- `APPFLOWY_JWT_SECRET`
- AppFlowy user credentials

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
