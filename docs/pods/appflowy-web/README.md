# `appflowy-web`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `appflowy` |
| Resource name | `appflowy-web` |
| Hostname / DNS | appflowy.cloudless.gr (UI) |
| Ports | served via nginx |
| Role | AppFlowy web UI. |

## How cloudless.gr uses it

Human/operator UI for editing CMS content. The Next app does not embed
this UI; editors open `appflowy.cloudless.gr` (CF Access + optional
admin autologin). Product pages read published content via `appflowy-cloud` APIs.

## Key files

- `src/lib/selfhosted-autologin.ts`
- `src/lib/cloudflare-access.ts`

## Secrets / config

- CF Access client for `appflowy`

## Related workloads

- [`appflowy-cloud`](../appflowy-cloud/)
- [`nginx`](../nginx/)
- [`gotrue`](../gotrue/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
