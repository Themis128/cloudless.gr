# Tailscale Funnel on omv / omv-ha — historical note

> **Status:** not the production edge (updated 2026-07-30)  
> **Canonical architecture:** [`docs/cluster/TAILSCALE-FABRIC.md`](../../docs/cluster/TAILSCALE-FABRIC.md)

## What changed

Public `cloudless.gr` traffic is:

```text
Client → Cloudflare → Worker cloudless2 (pi-origin-proxy)
       → Tunnel hostname pi-origin.cloudless.gr
       → omv NodePort :30300 (cloudless-app on k3s)
```

Tailscale **Funnel** is not part of that path. Using Funnel as a primary or HA
origin caused trust-boundary confusion (Bot Fight vs GHA, split-brain with the
Cloudflare Tunnel, SEO/CI noise).

The Pi app **still runs on k3s** — only the public front door moved to
Cloudflare. Do not delete NodePort `:30300` or the Tunnel ingress because Funnel
was retired as primary.

## When Funnel / Serve is still useful

| Use | How |
|-----|-----|
| Admin GUIs (Grafana, Meili) | Private **Serve** via `ProxyGroup/ingress` — fabric doc §5.4 |
| Break-glass node HTTPS | MagicDNS e.g. `https://github-omv.tail4ecae1.ts.net/…` (diagnostic only) |
| GHA health when CF returns 403 | **Join Tailscale** → `http://github-omv.tail4ecae1.ts.net:30300/api/health` (private L4). Do **not** use public Funnel as the CI SLA — see fabric ADR **D8**. |

## Do not

- Point Cloudflare origin or LB health checks at `*.ts.net` Funnel hosts as the
  long-term primary.
- Use public Funnel as the GitHub Actions “origin up?” contract (DERP timeouts).
- Expose databases or kube-apiserver via Funnel.
- Reintroduce one Funnel hostname per app Service.

## Legacy names (drift)

| Name | Notes |
|------|-------|
| `omv.tail8eb71.ts.net` | Old tailnet / Funnel hostname — do not use in new automation |
| `*.ts.cloudless.gr` | Abandoned public Tailscale DNS idea |
| `100.113.41.119` | Stale CGNAT — current SoT uses MagicDNS + `100.74.191.58` for github-omv |

If you need public HTTP, use Cloudflare Tunnel + Worker. If you need private
admin HTTP, use the fabric ProxyGroups.
