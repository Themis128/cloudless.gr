# Oracle Always Free ARM VM — HA failover for cloudless.gr

**Status:** Proposed (not deployed)  
**Date:** 2026-07-31  
**Primary today:** Cloudflare edge → Tunnel → Pi k3s (`pi-origin` / NodePort)  
**Related:** [FLY_IO_MIGRATION.md](FLY_IO_MIGRATION.md), [CLOUDFLARE-FREE-TIER-MIGRATION.md](CLOUDFLARE-FREE-TIER-MIGRATION.md), `workers/pi-origin-proxy/`, `workers/cloudless-failover/`

## Goal

Keep serving the **full Next.js app** from the Pi cluster as primary, and add an **off-site Always Free Oracle Cloud ARM VM** that runs the **same container image** as standby. Cloudflare stays the edge and DNS. Failover is request-level (Worker or Load Balancer), not a DNS TTL race.

This addresses **Pi / home-lab failure** (power, SD card, ISP, k3s down). It does **not** replace Cloudflare if Cloudflare itself is down (see [Fly.io role](#flyio-dns-and-role) below).

## Why not OpenNext on Workers Free / Pages + R2

| Option | Verdict for full-app HA |
|--------|-------------------------|
| OpenNext Worker (option A) | Blocked on **Workers Free** (~5.5 MiB gzip vs **3 MiB** limit; CPU 10 ms). Needs **Workers Paid**. |
| Pages / R2 “frontend” + Workers “API” | Poor fit for App Router SSR, auth, store, admin — dual stack. |
| Oracle Always Free ARM VM | Fits **full** SSR + APIs; free capacity; you manage the VM. |

## Target architecture

```text
                    ┌─────────────────────────────────────┐
   Users            │         Cloudflare (edge)           │
       │            │  DNS + WAF + TLS + failover Worker  │
       └───────────►│  (or Cloudflare Load Balancer)      │
                    └───────────────┬─────────────────────┘
                                    │
                    health-check Pi; fail → Oracle
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
   PRIMARY                                          STANDBY
   Cloudflare Tunnel                                Cloudflare Tunnel
   pi-origin.cloudless.gr                           oracle-origin.cloudless.gr
              │                                           │
              ▼                                           ▼
   Pi k3s (omv)                                     Oracle ARM Always Free VM
   Next.js container                                Same Next.js container
   (deploy-pi.yml)                                  Docker (or tiny k3s)
```

### Traffic rules

| State | Behavior |
|-------|----------|
| Pi healthy | Serve Pi (`x-served-by: pi-origin` or equivalent) |
| Pi timeout / 5xx | Serve Oracle (`x-served-by: oracle-standby`) |
| Both down | HTTP 503 |

Keep **Cloudflare DNS** for `cloudless.gr`. Do **not** move apex nameservers to Fly or Oracle.

### Optional: Fly.io as Cloudflare-bypass only

```text
Normal path:     users → Cloudflare → Pi | Oracle
Rare bypass URL: cloudless-proxy.fly.dev → (existing Fly HA proxy)
```

Apex traffic should **not** depend on Fly day-to-day. See [Fly.io DNS and role](#flyio-dns-and-role).

## What runs on the Oracle VM

- Linux on **Ampere A1** (Always Free ARM shape; stay within account free caps, e.g. up to 4 OCPU / 24 GB RAM total across instances).
- **Docker** (preferred) or a minimal k3s/k0s — same mental model as Pi.
- The **same app image** CI already builds for Pi (`linux/arm64`).
- Health endpoint used by the failover layer (`/api/health` or `/health`).
- Outbound HTTPS for Stripe, SES/email, Notion, Slack, etc.
- Auth: prefer continuing to use **Cloudflare D1** (`user-auth-db`) via supported remote access; otherwise document a **degraded** standby (see modes below).

### Standby modes (choose one before build)

| Mode | Behavior | When to use |
|------|----------|-------------|
| **Full twin** | Same image, same secrets class, D1 reachable, Stripe/webhooks aware | True product HA |
| **Degraded** | Marketing + contact + health; auth/checkout may 503 or read-only | Faster / cheaper ops; honest fallback page |

## Networking (pick one)

| Option | How Oracle is reached | Preference |
|--------|----------------------|------------|
| **A — Cloudflare Tunnel** | `cloudflared` on VM → `oracle-origin.cloudless.gr` | **Preferred** (no public app port) |
| **B — Tailscale** | VM joins mesh; failover Worker reaches Tailscale IP/host | Good if Tunnel quota/ops are constrained |
| **C — Public IP** | Security list + TLS on host | Least preferred |

## Failover policy (defaults)

- **Primary:** `pi-origin.cloudless.gr` (Tunnel → Pi NodePort).
- **Standby:** `oracle-origin.cloudless.gr`.
- **Timeout:** 5–10s on Pi before fallthrough.
- **Fail over on:** connect failure, timeout, upstream 5xx (not routine 4xx).
- **Methods:** all methods, including POST; buffer body once and replay (same pattern as `workers/cloudless-failover`).
- **Stripe:** prefer idempotent Checkout Session creation; accept rare duplicate attempts only if both origins briefly race.

Replace the legacy **CloudFront / AWS** fallback in `workers/cloudless-failover` with Oracle when this is implemented. Do not expand AWS as the standby path.

## Build order

1. Create Oracle Always Free ARM VM + harden SSH.
2. Install Docker; pull (or build) the Pi `linux/arm64` image; confirm `/api/health`.
3. Install Cloudflare Tunnel (or Tailscale); publish `oracle-origin.cloudless.gr`.
4. Inject secrets (mirror Pi runtime / Wrangler-compatible set for chosen mode).
5. Update failover Worker (or LB pool): Pi primary → Oracle standby; drop CloudFront.
6. Extend health probes / CI to hit both origins (same spirit as `cloudless-https-health-probe.yml`).
7. Document rollback: disable Oracle origin in Worker vars; Pi-only again.

## Operator inputs required

Human / account items that cannot be invented from the repo:

### Oracle Cloud

- [ ] Always Free account created and identity-verified (payment method often required; stay within free shapes).
- [ ] ARM A1 capacity in a chosen region.
- [ ] Ability to create VCN, subnet, VM, SSH key.
- [ ] SSH (or Tailscale) access for bootstrap, **or** willingness to run a provided `cloud-init` / bootstrap script.

### Cloudflare

- [ ] API token (or dashboard access) for: DNS, Tunnel (if option A), Workers edit for failover.
- [ ] Approval to add hostname `oracle-origin.cloudless.gr` on the shared tunnel (or a dedicated tunnel).

### App / secrets

- [ ] Decision: **full twin** vs **degraded**.
- [ ] Secrets for standby (Stripe, email, Notion, Slack, session/auth, D1 access path).
- [ ] Registry pull rights for the Pi image (ECR/GHCR/other), **or** “build on Oracle from `main`”.

### Policy

- [ ] Pi timeout and 5xx fail-over rules confirmed.
- [ ] Confirm POST failover (checkout/contact) is acceptable.

### Access model for implementation

Either:

- Agent/engineer gets Tunnel + Workers deploy rights and Oracle SSH, **or**
- PRs + scripts land in-repo; operator runs Oracle bootstrap and `wrangler deploy` locally.

Domain registrar / nameserver changes are **not** required.

## Fly.io DNS and role

**Do not use Fly as authoritative DNS for `cloudless.gr`.** Keep Cloudflare DNS (free).

| Piece | Free? | Notes |
|-------|-------|--------|
| Cloudflare DNS for `cloudless.gr` | Yes | Keep apex here |
| Fly `*.fly.dev` hostname | Yes | e.g. existing `cloudless-proxy.fly.dev` |
| Custom domain attached to a Fly **app** | Partially | Shared IPv4/IPv6 often free; **TLS certificates are billed** (per-hostname or wildcard) |
| Dedicated IPv4 on Fly | No | Typically billed monthly |
| Always-on Fly Machine running full Next.js | Generally no for new orgs | Legacy free allowances only for older orgs; pay-as-you-go otherwise |
| Fly as zone DNS for the whole domain | Not recommended | Not a free Cloudflare DNS replacement |

**Recommended Fly role:** optional **Cloudflare-bypass** proxy only (`fly-proxy-app` / `cloudless-proxy`), not the day-to-day HA path for Oracle.

## Pros and cons

| Pros | Cons |
|------|------|
| Full Next.js SSR + APIs (no 3 MiB Worker limit) | You patch OS, disk, Docker, reboots |
| Off-site vs home Pi (survives power/ISP) | Oracle signup / ARM capacity can be painful |
| Always Free within caps | Not serverless; monitoring is on you |
| Same image as Pi → one build pipeline | D1/R2 bindings are Cloudflare-native; standby must reach them or degrade |
| Aligns with leaving AWS standby behind | Does not cover Cloudflare control-plane outages |

## Comparison to alternatives

| Approach | Cost shape | Ops | Full app? |
|----------|------------|-----|-----------|
| OpenNext Worker standby | Workers Paid (~$5/mo) | Low | Yes (if under 10 MiB) |
| Oracle Always Free VM | $0 within free caps | Medium | Yes |
| Fly Machine full app | Usage / legacy free only | Medium | Yes |
| R2 / Pages degraded static | Free | Low | No (marketing shell only) |
| CloudFront / AWS fallback | Legacy | Avoid | Superseded |

## Out of scope (this doc)

- Moving primary hosting off Pi onto Oracle.
- Replacing Cloudflare edge with Fly DNS.
- Installing AWS CLI/SDK for standby secrets (prefer Cloudflare / existing repo wrappers).
- Claiming Workers Free can host full OpenNext for this codebase.

## References in-repo

- Live free path today: `workers/pi-origin-proxy/` (tiny Worker → Tunnel → Pi).
- Legacy failover Worker (AWS-oriented; replace target with Oracle): `workers/cloudless-failover/`.
- OpenNext Free-tier blocker: `.github/workflows/cloudflare-deploy.yml`, `ACTIONS-REQUIRED.md`.
- Existing Fly proxy (bypass, not apex DNS): `fly-proxy-app/`, [FLY_IO_MIGRATION.md](FLY_IO_MIGRATION.md).
