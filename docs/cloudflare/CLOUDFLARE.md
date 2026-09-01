# Cloudflare Configuration & Architecture

**Last Updated:** July 31, 2026
**Status:** ✅ Production Ready
**Maintainer:** DevOps / Infrastructure Team

---

## Table of Contents

1. [Overview](#overview)
2. [Account & Zone Configuration](#account--zone-configuration)
3. [DNS Records](#dns-records)
4. [Cloudflare Tunnel](#cloudflare-tunnel)
5. [Cloudflare Workers](#cloudflare-workers)
6. [Security & DDoS Protection](#security--ddos-protection)
7. [API Token Management](#api-token-management)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [Troubleshooting](#troubleshooting)
10. [Runbooks](#runbooks)

---

## Overview

Cloudflare provides a multi-layer infrastructure for cloudless.gr:

1. **DNS Management** - Zone records with Cloudflare nameservers
2. **Tunnel (Private Network)** - Secure connection to Raspberry Pi k3s cluster
3. **Workers (Serverless)** - Two Workers: pi-origin-proxy (Free) and cloudless-failover (Paid)
4. **DDoS & WAF Protection** - Managed security layer
5. **HA Failover** - Automatic failover between Pi origin and AWS CloudFront via cloudless-failover Worker

### Service Architecture

```
                    ┌─────────────────────────────┐
                    │   Cloudflare Zone (global)  │
                    │   cloudless.gr              │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
        ┌───────────▼─────────────┐  ┌──────────▼──────────────┐
        │  DNS Records            │  │  Workers & Failover   │
        │  • cloudless.gr         │  │  • cloudless2 (pi-origin-proxy)│
        │  • *.cloudless.gr       │  │  • cloudless-failover │
        │  • Tunnel endpoints     │  │  • Routes to Pi/AWS    │
        └────────────────────────┘  └──────────┬─────────────┘
                                               │
                ┌────────────────────────────────┼────────────────────────────────┐
                │                                │                                │
          ┌─────▼──────────────────┐    ┌────────▼─────────────┐    ┌──────────▼──────────┐
          │  Cloudflare Tunnel     │    │  AWS CloudFront      │    │  DNS Failover       │
          │  (Pi k3s origin)       │    │  (Lambda fallback)   │    │  (Watchdog)         │
          │  • omv-main-tunnel     │    │  • d3k7muo3c6lw6s    │    │  • Swaps CNAME      │
          │  • HTTP/QUIC           │    │  • d9c1d2e3f4g5h6i7  │    │  • Per-minute check │
          │  • Egress from Pi      │    │  • Primary: 2xx-3xx  │    │  • DNS-level HA     │
          └────────────────────────┘    └────────────────────┘    └─────────────────────┘
```

### Worker Architecture

The infrastructure uses **two Workers** with different purposes:

1. **`cloudless2` (pi-origin-proxy)** — Free-tier Worker (<50 KiB) that proxies all traffic from `cloudless.gr`, `www.cloudless.gr`, and `manage.cloudless.gr` to the Pi origin via Tunnel (`pi-origin.cloudless.gr` → NodePort 30300). This Worker stays under the 3 MiB gzip Free tier limit. Full OpenNext SSR (~5.5 MiB) cannot be deployed on Free.

2. **`cloudless-failover`** — Paid-tier Worker that implements request-level HA failover. It tries AWS CloudFront first (primary), and falls back to the Pi origin via Tunnel if AWS returns >= 400 or times out. Routes: `cloudless.gr/*` and `www.cloudless.gr/*`.

---

## Account & Zone Configuration

### Cloudflare Account

| Property        | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Account Name    | cloudless (via baltzakisthemis@gmail.com)             |
| Account ID      | `fb7dc7b69b662480cd5961a4d1913c78`                    |
| Zone            | cloudless.gr                                          |
| Zone ID         | `7025298073d6a5c645a6ad9add0cbf0e`                    |
| Nameservers     | `nova.ns.cloudflare.com` / `watson.ns.cloudflare.com` |
| Plan            | Free                                                  |
| Two-Factor Auth | ✅ Enabled                                            |

### Zone Settings

| Setting                 | Value                                                    | Purpose                                                     |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| SSL/TLS                 | Full                                                     | Edge ↔ origin encryption (Tunnel)                           |
| HSTS (zone)             | `max-age=63072000; includeSubDomains; preload` + nosniff | Force HTTPS via browser (matches app header)                |
| Minimum TLS             | 1.2                                                      | No TLS 1.0/1.1                                              |
| TLS 1.3                 | On (0-RTT)                                               | Modern clients                                              |
| HTTP/3                  | On                                                       | QUIC                                                        |
| Always Use HTTPS        | On                                                       | Redirect HTTP → HTTPS                                       |
| Security Level          | medium                                                   | Challenge medium+ threat scores (was `essentially_off`)     |
| Browser Integrity Check | On                                                       | Block obvious forged browsers                               |
| Email Obfuscation       | Off                                                      | Avoid React #418 hydration from CF email rewrite            |
| Bot Fight Mode          | Off                                                      | Free: not API-toggleable; leave off — crons use `pi-origin` |
| Apply / verify (TLS)    | `scripts/cf-zone-tls-harden.sh`                          | Idempotent zone TLS posture                                 |
| Apply / verify (WAF)    | `scripts/cf-zone-waf-harden.sh`                          | Idempotent Free-plan WAF posture                            |

---

## DNS Records

### Current Records

All production records point to Cloudflare Tunnel with orange cloud (proxied), except the apex/root which is served by the `cloudless2` Worker.

| Type  | Name            | Value                                                   | Status    | TTL  | Proxied | Notes                                           |
| ----- | --------------- | ------------------------------------------------------- | --------- | ---- | ------- | ----------------------------------------------- |
| CNAME | @ (root)        | cloudless2 Worker route                                 | 🔵 Active | Auto | ✅ Yes  | Served by pi-origin-proxy Worker                |
| CNAME | www             | cloudless2 Worker route                                 | 🔵 Active | Auto | ✅ Yes  | Served by pi-origin-proxy Worker                |
| CNAME | manage          | cloudless2 Worker route                                 | 🔵 Active | Auto | ✅ Yes  | Served by pi-origin-proxy Worker                |
| CNAME | pi-origin       | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | 🔵 Active | Auto | ✅ Yes  | Direct Tunnel origin for Worker proxy           |
| CNAME | omv             | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | 🔵 Active | Auto | ✅ Yes  | OMV admin panel                                 |
| CNAME | ftp             | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | 🔵 Active | Auto | ✅ Yes  | FTP web interface                               |
| CNAME | docs            | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Documentation portal                            |
| CNAME | meili           | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Meilisearch search engine                       |
| CNAME | tftp            | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | 🔵 Active | Auto | ✅ Yes  | Returns 404 (UDP not supported via HTTP tunnel) |
| CNAME | api             | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | 🔵 Active | Auto | ✅ Yes  | API gateway (fallback)                          |
| CNAME | n8n             | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Workflow automation (port 30900)                |
| CNAME | ntfy            | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Notification service (port 30080)               |
| CNAME | espocrm         | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | CRM system (port 30700)                         |
| CNAME | postiz          | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Social publishing (port 30500)                  |
| CNAME | appflowy        | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | CMS (port 30810)                                |
| CNAME | kuma            | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | Uptime Kuma (port 32501)                        |
| CNAME | logs            | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` | ✅ Active | Auto | ✅ Yes  | ESP32 alert API (port 30820)                    |
| TXT   | _acme-challenge | (Letsencrypt cert validation)                           | 🔵 Active | Auto | ❌ No   |                                                 |
| MX    | @               | mail.cloudless.gr (priority 10)                         | 🔵 Active | 3600 | ❌ No   |                                                 |
| TXT   | @               | v=spf1 include:_spf.mx.cloudflare.net ~all              | 🔵 Active | 3600 | ❌ No   | Updated from sendgrid to Cloudflare Email       |

### DNS Update Process

1. **Add/Modify Records via Dashboard**
   - Log into Cloudflare Dashboard
   - Navigate to cloudless.gr → DNS
   - Click "Add Record"
   - Select type (CNAME, A, MX, TXT, etc.)
   - Fill in name and value
   - Set TTL (Auto recommended)
   - Save

2. **Update via API** (Terraform/CLI)

   ```bash
   # Example: Create CNAME record
   curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "CNAME",
       "name": "subdomain",
       "content": "target.example.com",
       "ttl": 1,
       "proxied": true
     }'
   ```

3. **Terraform Management** (Recommended for Infrastructure)
   - Define records in `terraform/cloudflare/dns.tf`
   - Run `terraform plan` to preview
   - Run `terraform apply` to deploy
   - Git commit changes

---

## Cloudflare Tunnel

### Overview

Cloudflare Tunnel (formerly Argo Tunnel) provides a secure, outbound-only connection from the Pi k3s cluster to Cloudflare's global network. This eliminates the need for inbound firewall rules or public IPs.

### Tunnel Configuration

| Property        | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Tunnel ID       | `e977a490-58c5-4fdb-9155-86832e3e636a`                  |
| Tunnel Name     | omv-main-tunnel                                         |
| Account ID      | `fb7dc7b69b662480cd5961a4d1913c78`                      |
| Account Name    | cloudless (via baltzakisthemis@gmail.com)               |
| Status          | ✅ Active                                               |
| Origin          | `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com` |
| Egress Location | EU (sof01, vie02)                                       |
| DNS Access      | Enabled (Tailscale DNS integration)                     |

### Tunnel Credentials

The tunnel uses a credentials file stored on the Pi:

**File:** `/etc/cloudflared/e977a490-58c5-4fdb-9155-86832e3e636a.json`

⚠️ **SECURITY**: This file is:

- Private to root user (644 permissions — fixed 2026-07-20)
- NOT committed to git
- Rotated automatically by Cloudflare
- Contains certificate for Pi → Cloudflare connection

### Tunnel Configuration File

**Location:** `/etc/cloudflared/config.yml` (on omv-main Pi at 192.168.1.128)

The canonical configuration is maintained in the repo at:
`infrastructure/cloudflare-tunnels/cloudflared-config.yml`

Key ingress rules (excerpt):

```yaml
tunnel: e977a490-58c5-4fdb-9155-86832e3e636a
credentials-file: /etc/cloudflared/e977a490-58c5-4fdb-9155-86832e3e636a.json

ingress:
  # Main app — Worker handles apex; tunnel serves pi-origin
  - hostname: pi-origin.cloudless.gr
    service: http://192.168.1.128:30300
    originRequest:
      connectTimeout: 30s
      httpHostHeader: pi-origin.cloudless.gr

  # OMV UI & Services
  - hostname: omv.cloudless.gr
    service: http://localhost:80
    originRequest:
      connectTimeout: 15s
      httpHostHeader: omv.cloudless.gr

  # Grafana monitoring
  - hostname: grafana.cloudless.gr
    service: http://192.168.1.128:30850
    originRequest:
      noTLSVerify: true
      connectTimeout: 15s
      tcpKeepAlive: 30s

  # ... (see full config in infrastructure/cloudflare-tunnels/ingress-rules.yaml)

  # Default fallback
  - service: http_status:404
```

### Tunnel Management

#### Check Tunnel Status

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# View tunnel logs
sudo journalctl -u cloudflared -f

# Verify tunnel is connected
cloudflared tunnel info e977a490-58c5-4fdb-9155-86832e3e636a

# List active tunnel connections
curl -s http://localhost:7844/metrics | grep tunnel
```

#### Restart Tunnel

```bash
# Graceful restart
sudo systemctl restart cloudflared

# Force kill and restart (if hung)
sudo pkill -9 cloudflared
sudo systemctl start cloudflared

# Verify after restart
sleep 10
curl https://omv.cloudless.gr -I  # Should return 200
```

#### Rotate Tunnel Credentials

The credentials auto-rotate, but to manually re-generate:

```bash
# On local machine with Cloudflare CLI access
cloudflared tunnel token e977a490-58c5-4fdb-9155-86832e3e636a

# Copy output to Pi credentials file
```

### Ingress Rules

Each ingress rule maps a hostname to an origin service:

| Hostname               | Service                   | Port  | Notes                                 |
| ---------------------- | ------------------------- | ----- | ------------------------------------- |
| pi-origin.cloudless.gr | cloudless-app (NodePort)  | 30300 | Direct Tunnel origin for Worker proxy |
| omv.cloudless.gr       | OMV Web UI                | 80    | ProFTPD + TFTP management             |
| docs.cloudless.gr      | k3s docs service          | 30901 | Documentation portal                  |
| ftp.cloudless.gr       | FTP Web UI                | 80    | Same as OMV                           |
| meili.cloudless.gr     | Meilisearch search engine | 30902 | Runs on omv-main (120GB SSD)          |
| tftp.cloudless.gr      | N/A                       | 404   | UDP not supported via HTTP tunnel     |
| api.cloudless.gr       | API Gateway               | 80    | Fallback service                      |
| grafana.cloudless.gr   | Grafana                   | 30850 | Monitoring dashboard                  |
| kuma.cloudless.gr      | Uptime Kuma               | 32501 | Uptime monitoring                     |
| n8n.cloudless.gr       | n8n                       | 30900 | Workflow automation                   |
| ntfy.cloudless.gr      | ntfy                      | 30080 | Notification service                  |
| espocrm.cloudless.gr   | EspoCRM                   | 30700 | CRM system                            |
| postiz.cloudless.gr    | Postiz                    | 30500 | Social publishing                     |
| appflowy.cloudless.gr  | AppFlowy                  | 30810 | CMS                                   |
| logs.cloudless.gr      | ESP32 alert API           | 30820 | Alert API (WebSocket)                 |
| agent.cloudless.gr     | Agent API                 | 30924 | Agent API                             |
| vibe.cloudless.gr      | Vibe agent                | 30301 | Vibe agent                            |

---

## Cloudflare Workers

### Worker 1: cloudless2 (pi-origin-proxy)

**Purpose:** Free-tier origin proxy that forwards all traffic from `cloudless.gr`, `www.cloudless.gr`, and `manage.cloudless.gr` to the Pi via Tunnel.

**Configuration** (`workers/pi-origin-proxy/wrangler.jsonc`):

| Property              | Value                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Worker Name           | cloudless2                                                             |
| Type                  | HTTP Handler                                                           |
| Routes                | `cloudless.gr`, `www.cloudless.gr`, `manage.cloudless.gr`              |
| Plan                  | Free                                                                   |
| Environment Variables | `PI_ORIGIN_HOST` = `pi-origin.cloudless.gr`, `PI_TIMEOUT_MS` = `30000` |
| Size                  | <50 KiB (stays under Free tier 3 MiB gzip limit)                       |

**Traffic Flow:**

```
User → Cloudflare → cloudless2 (Worker, <50 KiB)
  → https://pi-origin.cloudless.gr
    → Tunnel → omv:30300 → cloudless-app
```

**Key Features:**

- Idempotent methods (GET/HEAD/OPTIONS) retry once on network failure or upstream 502
- Sets `x-served-by: pi-tunnel-proxy` or `pi-tunnel-proxy-error` headers
- GitHub Actions crons bypass this Worker by calling `pi-origin.cloudless.gr` directly

**Deployment:**

```bash
npx wrangler deploy --config workers/pi-origin-proxy/wrangler.jsonc --minify
```

### Worker 2: cloudless-failover

**Purpose:** Paid-tier Worker implementing request-level HA failover between AWS CloudFront (primary) and Pi origin (standby).

**Configuration** (`workers/cloudless-failover/wrangler.toml`):

| Property              | Value                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Worker Name           | cloudless-failover                                                                                                            |
| Type                  | HTTP Handler                                                                                                                  |
| Routes                | `cloudless.gr/*`, `www.cloudless.gr/*`                                                                                        |
| Environment Variables | `AWS_FALLBACK_HOST` = `d3k7muo3c6lw6s.cloudfront.net`, `PI_ORIGIN_HOST` = `pi-origin.cloudless.gr`, `PI_TIMEOUT_MS` = `10000` |

**Failover Logic:**

```javascript
async function handleRequest(request) {
  const url = new URL(request.url);
  const requestBody = hasBody(request.method) ? await request.arrayBuffer() : null;

  // --- Attempt 1: AWS CloudFront (primary) ---
  const awsResponse = await fetchOrigin(request, url, env.AWS_FALLBACK_HOST, requestBody, 30000);

  if (awsResponse && awsResponse.status < 400) {
    return tagResponse(awsResponse, "aws-primary");
  }

  // --- Attempt 2: Pi standby ---
  const piTimeout = parseInt(env.PI_TIMEOUT_MS || "10000", 10);
  const piResponse = await fetchOrigin(request, url, env.PI_ORIGIN_HOST, requestBody, piTimeout);

  if (piResponse && piResponse.status < 400) {
    return tagResponse(piResponse, "pi-standby");
  }

  // Serve the best available response
  if (awsResponse) return tagResponse(awsResponse, "aws-primary");
  if (piResponse) return tagResponse(piResponse, "pi-standby");

  return new Response("Service unavailable — both origins failed", {
    status: 503,
    headers: { "x-served-by": "cloudless-failover-error" },
  });
}
```

**Key Features:**

- All HTTP methods fail over (body is buffered and replayed on retry)
- AWS has 30s timeout, Pi has 10s timeout (configurable)
- Returns real error responses (4xx/5xx) rather than generic 503 when possible
- Sets `x-served-by: aws-primary` or `pi-standby` headers

**Deployment:**

```bash
cd workers/cloudless-failover
npx wrangler deploy
```

### Worker 3: Analytics Engine (index-analytics.ts)

**Purpose:** Handles analytics data export to parquet format in R2.

**Configuration** (`workers/wrangler.json`):

| Property    | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Worker Name | cloudless-analytics                                                                     |
| Routes      | `/api/analytics/export`, `/api/analytics/query`, `/api/analytics/rollup`                |
| Bindings    | `ANALYTICS` (Analytics Engine dataset), `DATALAKE_BUCKET` (R2), `ANALYTICS_BUCKET` (R2) |

### Deployment inventory (single source of truth)

The Cloudflare account currently holds **exactly two** deployed Workers:

| Live script name                                      | Source config                                                                            | Deployed by                                                                                | Notes                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `cloudless2`                                          | [`workers/pi-origin-proxy/wrangler.jsonc`](../../workers/pi-origin-proxy/wrangler.jsonc) | [`.github/workflows/cloudflare-deploy.yml`](../../.github/workflows/cloudflare-deploy.yml) | The Free-tier pi-origin proxy described above. |
| `cloudless-monorepo-production-analyticsworkerscript` | Analytics Engine worker (see Worker 3)                                                   | Monorepo pipeline                                                                          | Serves `/api/analytics/*`.                     |

Verify with `mcp__cloudflare-observability__workers_list` or
`npx wrangler deployments list --config workers/pi-origin-proxy/wrangler.jsonc`.

#### Alternate configs present in the repo but **not currently deployed**

Two additional wrangler configs describe a _hypothetical_ full Next.js
deployment on Workers (static assets from `./out`, Durable Objects
`CounterAgent`/`EchoAgent`/`CodingAgent`, D1 `AUTH_DB`, R2 buckets, AI, cron
triggers). They exist for the AWS→Cloudflare migration explorations and are
not part of the current production edge:

| File                                                                   | Would deploy as                                                            | Triggered by                                                                               | Status                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`wrangler-cloudflare-free.json`](../../wrangler-cloudflare-free.json) | `cloudless-gr-free` (custom domain on `cloudless.gr` + `www.cloudless.gr`) | [`.github/workflows/deploy-cloudflare.yml`](../../.github/workflows/deploy-cloudflare.yml) | Experimental. If deployed, its `custom_domain: true` routes on `cloudless.gr` / `www.cloudless.gr` would collide with `cloudless2`. Do not run without first removing the `cloudless2` routes. |
| ~~`wrangler-cloudless2.json`~~                                         | (deleted 2026-08-07)                                                       | —                                                                                          | Was a footgun: also named itself `cloudless2` but with entirely different bindings. Removed alongside `scripts/store_cloudflare_token.sh` which referenced it.                                 |

The historical `cloudless-failover` Paid-tier Worker described earlier in this
document is **not deployed** — the CloudFront-primary/Pi-standby failover
plan was superseded by the direct Pi proxy. Treat that section as design
history until the Worker is re-created.

---

## Security & DDoS Protection

### DDoS Mitigation

Cloudflare automatically mitigates Layer 3/4 (network) and Layer 7 (application) DDoS attacks:

| Protection Level | Setting                           |
| ---------------- | --------------------------------- |
| Advanced DDoS    | ✅ Enabled (free plan)            |
| Sensitivity      | High                              |
| Challenge        | ✅ CAPTCHA for suspicious traffic |
| Rate Limiting    | Custom rules (see below)          |

### Web Application Firewall (WAF)

**Status:** ✅ Managed Rules Enabled

| Rule Set                  | Action    | Notes                    |
| ------------------------- | --------- | ------------------------ |
| OWASP ModSecurity Core    | Challenge | SQL injection, XSS, etc. |
| Cloudflare Managed Rules  | Block     | Known malware, botnets   |
| Cloudflare Bot Management | Challenge | Suspicious bot traffic   |

### Custom WAF Rules

Custom rulesets require **Zone → Firewall Services** on `CLOUDFLARE_API_TOKEN`.
Without that scope, `GET /zones/:id/rulesets` returns Authentication error
(token is valid for Zone Settings/DNS/Workers but not Firewall). Rotate via
`skills/cloudflare-token-doctor/SKILL.md` Stage 1 (Firewall Services: Edit
is now included in the recommended token permissions).

Until the token is rotated, manage rules in the dashboard
(Security → WAF) or after Stage 1+2 of the token doctor.

### SSL/TLS Settings

| Setting           | Value                                          | Purpose                   |
| ----------------- | ---------------------------------------------- | ------------------------- |
| SSL Mode          | Full                                           | Edge ↔ Tunnel origin      |
| HTTP to HTTPS     | Redirect                                       | Force secure connections  |
| Minimum TLS       | 1.2                                            | No legacy clients         |
| HSTS (zone + app) | `max-age=63072000; includeSubDomains; preload` | Prevent downgrade attacks |
| Apply             | `scripts/cf-zone-tls-harden.sh`                | Idempotent                |

---

## API Token Management

### Current Token

| Property        | Value                                          |
| --------------- | ---------------------------------------------- |
| Token Name      | cloudless2                                     |
| Type            | User API Token                                 |
| Prefix          | cfut_(vs cfat_ for API keys)                   |
| Permissions     | Zone.Zone:Read + Zone.DNS:Edit + Zone.SSL:Edit |
| Scopes          | cloudless.gr zone only                         |
| Status          | ✅ Active                                      |
| Storage         | GitHub Secret `CLOUDFLARE_API_TOKEN`           |
| Rotation Policy | Annual or on compromise                        |

### Token Verification

```bash
# Test token validity
TOKEN=$(gh secret view CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr --json -t - | jq -r .value)

curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# {"success":true,"errors":[],"messages":[],"result":{"id":"...","status":"active"}}
```

### Token Permissions

| Permission                  | Scope        | Purpose                             |
| --------------------------- | ------------ | ----------------------------------- |
| Zone.Zone:Read              | cloudless.gr | Read zone settings                  |
| Zone.DNS:Edit               | cloudless.gr | Modify DNS records                  |
| Zone.SSL:Edit               | cloudless.gr | Manage SSL/TLS                      |
| Zone.Zone:Edit              | cloudless.gr | (Recommended) Zone-level operations |
| Zone.Firewall Services:Edit | cloudless.gr | (Recommended) Manage WAF rulesets   |
| Zone.Load Balancing:Edit    | cloudless.gr | (Optional) If using Load Balancer   |

### Creating New Token

1. Log into Cloudflare Dashboard
2. Go to My Profile → API Tokens
3. Click "Create Token"
4. Choose "Custom Token" (not "API Key")
5. Grant permissions: `Zone.Zone:Read`, `Zone.DNS:Edit`, `Zone.SSL:Edit`
6. (Recommended) Add `Zone.Firewall Services:Edit` for WAF management
7. Specify zone: cloudless.gr
8. Click "Create Token"
9. Copy token immediately (not shown again)
10. Store as GitHub Secret: `gh secret set CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr`

### Token Rotation Checklist

When rotating (e.g., quarterly):

- [ ] Create new token in Cloudflare Dashboard
- [ ] Test new token with `scripts/cf-token-smoketest.sh`
- [ ] Update `CLOUDFLARE_API_TOKEN` GitHub Secret
- [ ] Update cloud session secret (for MCP tools)
- [ ] Test terraform/CLI tools still work
- [ ] Wait 24 hours before deleting old token
- [ ] Delete old token in Cloudflare Dashboard
- [ ] Document rotation date in this file

---

## Monitoring & Alerts

### Key Metrics

| Metric            | Alert Threshold | Action                     |
| ----------------- | --------------- | -------------------------- |
| Tunnel Status     | Down > 5min     | Page on-call engineer      |
| 5xx Errors        | > 10/min        | Page engineer              |
| Cache Hit Ratio   | < 50%           | Investigate cache settings |
| Worker Errors     | > 5%            | Review worker logs         |
| DNS Query Failure | > 1%            | Investigate nameserver     |

### Setting Up Alerts

**Via Cloudflare Dashboard:**

1. cloudless.gr → Notifications → Create Notification
2. Choose notification type:
   - Tunnel Down/Up
   - DDoS Attack
   - SSL Alert
   - Firewall Event
3. Set threshold and recipient email
4. Save

**Recommended Alerts:**

- ✅ Tunnel connectivity (down → critical)
- ✅ DDoS attack detected
- ✅ SSL certificate expiring (30 days out)
- ✅ 5xx error rate spike

### Monitoring Dashboard

**Cloudflare Analytics:** cloudless.gr → Analytics

Displays:

- Requests over time
- Cache performance
- Bandwidth usage
- Threat activity
- Error rates by type

---

## Troubleshooting

### Issue: Tunnel Status Shows "Disconnected"

**Symptoms:**

- `curl https://omv.cloudless.gr` → Connection timeout or 522 error
- Cloudflare Dashboard shows "No Connectors"

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check cloudflared service
sudo systemctl status cloudflared

# Check logs for errors
sudo journalctl -u cloudflared -n 50

# Verify credentials file exists
ls -la /etc/cloudflared/e977a490-*.json
```

**Solutions:**

1. **Restart cloudflared:**

   ```bash
   sudo systemctl restart cloudflared
   sleep 10
   curl https://omv.cloudless.gr -I
   ```

2. **Check network connectivity:**

   ```bash
   ping 1.1.1.1        # Cloudflare DNS
   ping 8.8.8.8        # Google DNS
   ss -tulpn | grep cloudflared  # Check ports
   ```

3. **Regenerate credentials (if corrupted):**

   ```bash
   sudo rm /etc/cloudflared/e977a490-*.json
   cloudflared tunnel login
   sudo systemctl restart cloudflared
   ```

### Issue: cloudless.gr Returns 502 via Worker

**Symptoms:**

- Worker returns 502 even though Tunnel is active
- `x-served-by: pi-tunnel-proxy-error` header present

**Root Causes:**

- Pi origin (NodePort 30300) not responding
- cloudless-app pod not running on omv node
- Network connectivity issues between Worker and Tunnel

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check cloudless-app pod
kubectl get pods -n cloudless | grep cloudless
kubectl get svc cloudless-service -n cloudless -o wide

# Test NodePort directly (bypass Tunnel)
curl -I http://192.168.1.128:30300/api/health
```

**Solutions:**

1. **Restart cloudless-app deployment:**

   ```bash
   kubectl rollout restart deployment/cloudless-app -n cloudless
   ```

2. **Check Pi resources:**

   ```bash
   free -h
   df -h
   ```

### Issue: docs.cloudless.gr Returns 502 Bad Gateway

**Symptoms:**

- Other services (omv, n8n) return 200
- Only docs.cloudless.gr returns 502
- Tunnel logs show no connection errors

**Root Causes:**

- K3s service on wrong port
- Pod not running
- Service misconfigured

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check k3s service
kubectl get svc docs-service -o wide -n cloudless

# Check if pod is running
kubectl get pods -n cloudless | grep docs

# Get pod status details
kubectl describe pod docs-server-* -n cloudless

# Test connectivity directly from Pi
curl http://192.168.1.128:30901 -v
```

**Solutions:**

1. **Update tunnel config to correct port:**

   ```bash
   sudo nano /etc/cloudflared/config.yml
   sudo systemctl restart cloudflared
   ```

2. **Restart the docs pod:**

   ```bash
   kubectl rollout restart deployment/docs-server -n cloudless
   ```

3. **Check pod logs:**

   ```bash
   kubectl logs -f deployment/docs-server -n cloudless
   ```

### Issue: meili.cloudless.gr Returns 302 Redirect

**Symptoms:**

- Returns 302 redirect instead of Meilisearch UI
- Response headers show wrong origin

**Root Cause:**

- Tunnel ingress configured for `127.0.0.1:30902`
- Meilisearch pod may not be running or service port misconfigured

**Diagnosis:**

```bash
# SSH to Pi
ssh tbaltzakis@192.168.1.128

# Check Meilisearch pod
kubectl get pods -n meilisearch
kubectl get svc meilisearch -n meilisearch

# Test local connectivity
curl http://192.168.1.128:30902 -v
```

### Issue: "cert not yet valid" Error

**Symptoms:**

- Tunnel logs show certificate validation error
- Tunnel keeps restarting

**Solution:**

```bash
# SSH to Pi and check system clock
date

# If time is wrong, sync it
sudo timedatectl set-ntp true
sudo timedatectl

# Restart cloudflared
sudo systemctl restart cloudflared
```

### Issue: Bot Fight Mode Interstitial on API Calls

**Symptoms:**

- GitHub Actions or cron jobs receive 403 "Just a moment..." interstitial
- Direct curl works fine

**Solution:**

Bot Fight Mode is intentionally kept OFF on the Free plan. If it gets enabled:

1. Cloudflare Dashboard → cloudless.gr → Security → Bots
2. Set "Bot Fight Mode" to OFF
3. For cron workflows, use `pi-origin.cloudless.gr` directly instead of `cloudless.gr`

---

## Runbooks

### Daily Operations

**Morning Checklist (5 min):**

```bash
# 1. Check tunnel status
curl -s https://omv.cloudless.gr -I | head -1
curl -s https://docs.cloudless.gr -I | head -1
curl -s https://meili.cloudless.gr -I | head -1

# 2. Check for errors in logs
ssh tbaltzakis@192.168.1.128 "sudo journalctl -u cloudflared --since '10 minutes ago' | tail -20"

# 3. Verify DNS is resolving
dig cloudless.gr +short
dig omv.cloudless.gr +short
```

**Weekly Checklist (15 min):**

```bash
# 1. Check all DNS records
# In Cloudflare Dashboard: cloudless.gr → DNS → Review all records

# 2. Review DDoS stats
# In Cloudflare Dashboard: cloudless.gr → Analytics → Threats

# 3. Check worker error rate
# In Cloudflare Dashboard: cloudless.gr → Workers → Analytics

# 4. Verify SSL certificates
# In Cloudflare Dashboard: cloudless.gr → SSL/TLS → Origin Server
```

**Monthly Checklist (30 min):**

```bash
# 1. Review and rotate API token if needed
# See "Token Rotation Checklist" above

# 2. Audit DNS records for cleanup
# Check for unused or test records

# 3. Review WAF rules and block lists
# In Cloudflare Dashboard: cloudless.gr → Security → WAF

# 4. Test failover manually
# Shut down tunnel, verify AWS fallback works
# Restart tunnel, verify Pi origin works
```

### Emergency Response

**Tunnel Down (Critical)**

1. Receive alert: Tunnel disconnected
2. SSH to Pi: `ssh tbaltzakis@192.168.1.128`
3. Check status: `sudo systemctl status cloudflared`
4. Restart: `sudo systemctl restart cloudflared`
5. Verify: `curl https://omv.cloudless.gr -I` (should return 200)
6. If still down, check DNS to confirm failover to AWS working
7. Escalate if AWS failover not working

**DDoS Attack (High)**

1. Monitor: Watch Cloudflare Analytics
2. No action needed - Cloudflare mitigates automatically
3. If rate limiting needed, update WAF rules:
   - Cloudflare Dashboard → cloudless.gr → Security → Rate Limiting
   - Add rule for `/api/*` : 100 requests per 10 minutes
4. Communicate status to team

**DNS Poison/Hijack (Critical)**

1. Change password immediately: Cloudflare Dashboard
2. Enable 2FA if not already enabled
3. Audit recent DNS changes for unauthorized modifications
4. Contact Cloudflare support if compromised

---

## Reference

### Useful Links

- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Cloudflare API Docs:** https://developers.cloudflare.com/api
- **Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- **Worker Docs:** https://developers.cloudflare.com/workers

### Team Contacts

| Role               | Contact    | Timezone |
| ------------------ | ---------- | -------- |
| DevOps Lead        | tbaltzakis | CET/EET  |
| On-Call Escalation | (TBD)      | (TBD)    |
| Cloudflare Support | Premium    | 24/7     |

### Revision History

| Date       | Author     | Change                                                                                                                                                                                                                       |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-04 | Kiro CLI   | Initial comprehensive documentation                                                                                                                                                                                          |
| 2026-07-05 | tbaltzakis | Fixed docs.cloudless.gr port (30900 → 30901), updated DNS status table                                                                                                                                                       |
| 2026-07-06 | Cline      | Updated meili.cloudless.gr to omv-main (127.0.0.1), removed omv-ha nodeSelector                                                                                                                                              |
| 2026-07-20 | Cline      | Fixed tunnel credentials permissions (400 → 644), updated tunnel ID                                                                                                                                                          |
| 2026-07-26 | Cline      | Updated DNS records with all active services, added Worker architecture                                                                                                                                                      |
| 2026-07-31 | Cline      | Comprehensive update: corrected tunnel ID, added missing DNS records, documented both Workers, updated token storage to GitHub Secrets                                                                                       |
| 2026-08-07 | Claude     | Added Deployment Inventory section; flagged `cloudless-gr-free` as unused; noted `cloudless-failover` is documented but not deployed; removed orphan `wrangler-cloudless2.json` and dead `scripts/store_cloudflare_token.sh` |

---

**Status:** ✅ Production Ready
**Last Reviewed:** 2026-08-07
**Next Review:** 2026-09-07 (monthly)
