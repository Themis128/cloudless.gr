# `nginx`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `nginx` |
| Hostname / DNS | appflowy.cloudless.gr |
| Ports | NodePort 30810 |
| Role | Edge reverse-proxy for the AppFlowy stack. |

## How cloudless.gr uses it

Terminates the public AppFlowy hostname and routes to web/cloud/admin.
Next.js only sees `https://appflowy.cloudless.gr` (or CF Access).

## Key files

- `infrastructure/appflowy/`
- CF tunnel ingress

## Secrets / config

- TLS via CF / tunnel

## Related workloads

- [`appflowy-web`](../appflowy-web/)
- [`appflowy-cloud`](../appflowy-cloud/)
- [`admin-frontend`](../admin-frontend/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
