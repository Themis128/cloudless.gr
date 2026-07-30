# `docs-server`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | Deployment |
| Namespace | `default` |
| Resource name | `docs-server` |
| Hostname / DNS | docs.cloudless.gr (tunnel → NodePort 30901) |
| Ports | NodePort 30901 |
| Role | Standalone docs portal host (separate from Notion/AppFlowy CMS). |

## How cloudless.gr uses it

Public docs hostname via Cloudflare Tunnel. Product `/[locale]/docs` in Next
may still use AppFlowy/Notion APIs; this pod is the tunnel target for
`docs.cloudless.gr` when that ingress is enabled.

## Key files

- `infrastructure/cloudflare-tunnels/`
- `src/app/api/docs/**`
- `src/lib/appflowy-docs.ts`

## Secrets / config

- tunnel config on host

## Related workloads

- [`cloudflared`](../cloudflared/)
- [`appflowy-cloud`](../appflowy-cloud/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
