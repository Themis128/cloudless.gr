# `cloudflared`

> Part of [docs/pods](../README.md) — omv k3s workload atlas.

## Identity

| Field | Value |
|-------|-------|
| Kind | HostService |
| Namespace | `omv-host` |
| Resource name | `cloudflared` |
| Hostname / DNS | shared tunnel UUID e977a490-58c5-4fdb-9155-86832e3e636a |
| Ports | host process → NodePorts |
| Role | Cloudflare Tunnel — public ingress for all `*.cloudless.gr` apps. |

## How cloudless.gr uses it

**No SDK in Next.** Every public hostname (app, EspoCRM, Kuma, Grafana, …)
reaches Pi NodePorts through this tunnel. App uses public HTTPS URLs from
config; CF Access tokens for admin autologin.

## Key files

- `infrastructure/cloudflare-tunnels/*`
- `skills/cloudflare-tunnel-ops/SKILL.md`
- `src/lib/cloudflare-access.ts`

## Secrets / config

- tunnel credentials on omv host
- `CLOUDFLARE_ACCOUNT_ID`
- Access service tokens

## Related workloads

- [`cloudless-app`](../cloudless-app/)
- [`espocrm`](../espocrm/)
- [`n8n`](../n8n/)
- [`uptime-kuma`](../uptime-kuma/)
- [`kube-prom-grafana`](../kube-prom-grafana/)
- [`postiz`](../postiz/)
- [`meilisearch`](../meilisearch/)
- [`ntfy`](../ntfy/)

## See also

- [Cluster DB inventory](../../databases/omv-cluster.md)
- [Tailscale fabric](../../cluster/TAILSCALE-FABRIC.md)
- [CLUSTER-MAP.md](../../../CLUSTER-MAP.md)
