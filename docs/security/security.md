# Security posture

Single source of truth for the security controls protecting the cloudless.gr
app — both the cloud Lambda primary and the Pi K3s standby (which runs the
same image, so all controls below apply identically to both).

## Snapshot

| Layer | Control | Where |
|---|---|---|
| Transport | HTTPS at every public edge (ACM certs on CloudFront + APIGW), HSTS preload | `src/proxy.ts`, AWS infra |
| Transport | Production HTTP→HTTPS 308 redirect | `src/proxy.ts` |
| Auth (user) | OIDC JWT (Cognito or Cognito), RS256-verified against provider JWKS | `src/lib/api-auth.ts` |
| Auth (admin) | All 71 `/api/admin/*` routes gated by `requireAdmin`/`requireAuth` | `src/app/api/admin/**` |
| Auth (cron) | `Bearer ${CRON_SECRET}`, constant-time compare | `src/lib/cron-auth.ts` |
| Auth (webhook) | Stripe `constructEvent`, EspoCRM v3 timing-safe HMAC, Notion HMAC, Pi-sync HMAC-SHA256 | `src/app/api/webhooks/**`, `.github/workflows/build-pi-image.yml` |
| Headers | HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin | `src/proxy.ts` |
| Headers | Permissions-Policy with 24 directives — most denied, only payment/fullscreen/autoplay/web-share/publickey-credentials-get kept as `(self)` | `src/proxy.ts` |
| Headers | Content-Security-Policy-Report-Only (full directive set; `report-uri /api/csp-report` + `report-to csp-endpoint`) | `src/proxy.ts` |
| CORS | Strict allowlist: `cloudless.gr`, `www.cloudless.gr` | `src/proxy.ts` |
| Rate limit | Per-IP, per-route in-memory token bucket; conservative caps acknowledging per-Lambda × N concurrency | `src/proxy.ts` |
| SSRF guard | `/api/notion-image` validates URL hostname against allowlist (`*.amazonaws.com`, `files.notion.so`) before fetching | `src/app/api/notion-image/route.ts` |
| Secrets at rest | SSM Parameter Store SecureString (AWS-managed KMS) | SSM `/cloudless/production/*` |
| Secrets in flight | Read at runtime via SSM SDK (Lambda IAM role on cloud, `cloudless-pi-standby` IAM user on Pi) | `src/lib/ssm-config.ts` |
| Error reporting | Sentry events + breadcrumbs scrubbed for sensitive headers, query keys, request body keys, token-shaped strings, cookies | `src/lib/sentry-scrub.ts` |
| Push protection | GitHub Secret Scanning blocks pushes containing AWS keys, JWTs, Stripe keys, etc. | repo-level setting |
| Dep vulns | `pnpm audit` clean (0 advisories at last check); Dependabot configured | `package.json`, `.github/workflows/dependabot-automerge.yml` |
| File uploads | None — no `formData`/multipart routes in `/api/*` | (absence-as-control) |
| Cookies | None set by app code; auth is Bearer-token via `Authorization` header — minimal CSRF surface | (absence-as-control) |
| Stack-trace leak | API errors return generic codes; raw error logged server-side where Sentry scrubber redacts | `src/app/api/admin/notion/status/route.ts` and similar |

## Detailed controls

### Authentication

- **User auth** uses Cognito (default, `auth.cloudless.gr` realm `master`) or
  AWS Cognito (when `COGNITO_ISSUER` is set — serverless path). Tokens are
  verified against the active provider's JWKS (`createRemoteJWKSet`), with
  issuer + audience asserted.
- **Admin gate** — `requireAdmin()` decodes the verified token and asserts
  the user is in the admin group (`groups` claim for Cognito,
  `cognito:groups` for Cognito). Used by every route under
  `src/app/api/admin/*` (verified by audit script in this repo).
- **Admin UI guard** — `AdminLayoutClient` checks `isAdmin` from
  `AuthContext` client-side and immediately redirects to `/dashboard` for
  non-admin users and to `/auth/login?next=/admin` for unauthenticated
  ones. The server-side `requireAdmin()` on every API route is the
  authoritative enforcement; the UI redirect is defence-in-depth only.
- **Infrastructure shortcuts** — The admin panel sidebar and dashboard
  include external links to `grafana.cloudless.gr` (Grafana) and
  `manage.cloudless.gr` (Cluster Manager). These links open in a new
  tab and carry no credentials or tokens from cloudless.gr. Each tool
  enforces its own independent authentication: Grafana uses its built-in
  login; Cluster Manager is behind oauth2-proxy → Cognito SSO.
- **Cron / scheduled jobs** — protected by `CRON_SECRET` Bearer token,
  compared with `safeEqual` (constant time) to defeat timing oracles.

### Webhook signatures

| Source | Algorithm | Verifier |
|---|---|---|
| Stripe | HMAC via `stripe.webhooks.constructEvent` (canonical, includes timestamp) | `src/app/api/webhooks/stripe/route.ts` |
| EspoCRM | v3 HMAC-SHA256 over `${method}${url}${body}${timestamp}`, `timingSafeEqual` | `src/app/api/webhooks/hubspot/route.ts` |
| Notion | HMAC-SHA256 of body | `src/app/api/webhooks/notion/route.ts` |
| Pi sync (build → Pi) | HMAC-SHA256 over JSON body, sent as `X-Hub-Signature-256` | `.github/workflows/build-pi-image.yml` |

### Transport headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), ambient-light-sensor=(), autoplay=(self),
  battery=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self),
  geolocation=(), gyroscope=(), hid=(), idle-detection=(), magnetometer=(),
  microphone=(), midi=(), payment=(self), picture-in-picture=(),
  publickey-credentials-get=(self), screen-wake-lock=(), serial=(), usb=(),
  web-share=(self), xr-spatial-tracking=()
Content-Security-Policy-Report-Only: <see src/proxy.ts:CSP_REPORT_ONLY>
Report-To: {"group":"csp-endpoint","max_age":86400,"endpoints":[{"url":"/api/csp-report"}],"include_subdomains":true}
```

### CSP — current state and roadmap

The CSP is currently shipped as `Content-Security-Policy-Report-Only`. This
gathers violation data without blocking. Reports land at `/api/csp-report`
(handles both legacy `application/csp-report` and modern
`application/reports+json` payloads) and emit a single structured log line
per violation: `[csp-violation] dir=<directive> blocked=<uri> source=<file>
doc=<documentURL> disp=<enforce|report>`.

**Roadmap to enforce**:

1. Run with `Report-Only` for ~1 week of representative traffic.
2. Group reports by `(directive, blocked-uri)` from the log stream.
3. Allowlist any legitimate sources that surface; remove anything that
   doesn't have a clear business need.
4. Flip the header from `Content-Security-Policy-Report-Only` →
   `Content-Security-Policy` and add `upgrade-insecure-requests` (currently
   omitted since it's silently ignored in Report-Only mode).

### Compression — current posture (verified live)

Posture is optimal for the typical Next.js + Lambda + CloudFront stack. The
table below records what each layer does and why; the live values are
verifiable any time via `pnpm tsx scripts/verify-prod-posture.mts`.

| Layer | Behavior | Notes |
|---|---|---|
| CloudFront edge | On-the-fly Brotli for HTML/CSS/JS/JSON; falls back to gzip if client doesn't accept br | `Compress Objects Automatically` is on by default in SST's `Nextjs` construct. Confirmed live: `Content-Encoding: br` on `/en` HTML, body 24,554 B after decode. |
| Next.js server (Lambda) | `compress: true` (gzip) — redundant when behind CloudFront, but the explicit setting documents intent for the Pi standby path. | `next.config.ts` |
| Next.js static assets | Precompressed at build time; CloudFront serves the precompressed variant. | `public/_next/static/**` get long-cache headers automatically. |
| Pi K3s standby | In-process gzip via Next.js `compress: true` (no edge in front of Pi). | If the Pi standby ever needs Brotli, add it at the K3s ingress (Traefik supports `compress` middleware). |
| Tiny endpoints (e.g. `/api/health` 72B) | Correctly NOT compressed — gzip framing alone exceeds the body. | This is the right behavior; compressing 72B inflates it to ~90B. |
| Images | Optimizer transcodes to AVIF when client supports it, WebP fallback. | `next.config.ts` `formats: ["image/avif", "image/webp"]`. AVIF is 20-30% smaller than WebP at equal perceptual quality. |
| Image cache | 30-day TTL on optimized variants. | `next.config.ts` `minimumCacheTTL: 60*60*24*30`. Variants are content-addressed by URL so a long TTL is safe. |

### Encryption — current posture (verified live)

| Layer | Behavior | Verified |
|---|---|---|
| TLS protocol floor | TLSv1.2 minimum (TLSv1.3 negotiated in practice) | ✓ live: TLSv1.3 |
| TLS cipher | AEAD only (AES-GCM or ChaCha20-Poly1305) | ✓ live: `TLS_AES_128_GCM_SHA256` |
| HTTP version | HTTP/2 over TLS (HTTP/3 may be available too) | ✓ live: ALPN negotiated `h2` |
| HSTS | `max-age=63072000` (2 years) + `includeSubDomains` + `preload` | ✓ live; preload-list eligible |
| Cert source | ACM (CloudFront) + ACM (APIGW SECONDARY) — both auto-renewing | ✓ APIGW cert has 197 days remaining as of last `pi-tls-cert-check` run |
| Secrets at rest | SSM Parameter Store SecureString (AWS-managed KMS) | — |
| Secrets in flight | Read at runtime by the runtime IAM role (Lambda task role for cloud, `cloudless-pi-standby` IAM user for Pi) | — |
| `Authorization` / Cookies / `*-Signature` headers | Scrubbed before leaving Sentry runtime | covered by `__tests__/sentry-scrub.test.ts` |

### Verifying

```bash
# Single command — checks 8 properties against prod
pnpm tsx scripts/verify-prod-posture.mts            # cloudless.gr
pnpm tsx scripts/verify-prod-posture.mts pi-origin.cloudless.gr   # Pi surface

# Or manually:
echo | openssl s_client -connect cloudless.gr:443 -servername cloudless.gr 2>/dev/null \
  | grep -E "Protocol|Cipher"
curl -sI --http2 -H "Accept-Encoding: br, gzip" https://cloudless.gr/en \
  | grep -iE "HTTP/|content-encoding|strict-transport"
```

### Rate limiting

The in-process limiter in `src/proxy.ts` is **per-Lambda-container**, meaning
the effective ceiling is roughly `(concurrent containers) × max`. Caps were
chosen to keep the worst case bounded for accidental loops and small-scale
spam:

| Route | Window | Max / container / window |
|---|---|---|
| `/api/contact` | 60s | 3 |
| `/api/subscribe` | 60s | 2 |
| `/api/unsubscribe` | 60s | 3 |
| `/api/checkout` | 60s | 6 |
| `/api/calendar/book` | 60s | 3 |
| `/api/hubspot/ticket` | 60s | 3 |
| `/api/crm/contact` | 60s | 3 |
| `/api/chat` (LLM proxy) | 60s | 12 |
| `/api/admin/*` (any) | 60s | 90 |

For real burst protection (DDoS, distributed attackers), the right answer is
AWS WAF rate-based rules at the CloudFront edge or APIGW usage plans. The
in-process limiter is a best-effort first line, not a shield.

### Sentry secret scrubber

`src/lib/sentry-scrub.ts` runs as `beforeSend` and `beforeBreadcrumb` on all
three Sentry runtimes (server, client, edge). It redacts:

- **Headers**: `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`,
  `X-Cron-Secret`, `Stripe-Signature`, `*Hub-Signature*`, `*Notion-Signature*`
- **Object keys** matching `/^(password|token|secret|key|api_-?key|access[_-]?token|...|nonce|bearer)$/i` — recursive into nested objects/arrays
- **Token-shaped strings** anywhere in the payload (regardless of key):
  AWS AKID `AKIA...`, AWS secret key shape, JWT triple, GitHub PAT (`ghp_...`,
  `gho_...`, `ghs_...`, `ghu_...`, `ghr_...`), Stripe live key (`sk_live_...`),
  Notion v2 secret (`secret_...`)
- **Cookies on the request object** — every value replaced regardless of shape
- **Query strings + URL params** with sensitive keys/values

Coverage is locked in by `__tests__/sentry-scrub.test.ts` (8 tests).

### CSP report endpoint contract

`POST /api/csp-report`

- Accepts both `application/csp-report` (legacy) and `application/reports+json`
  (modern Reporting-API) shapes.
- Returns `204 No Content` always (errors are silently ignored to avoid
  retry storms from misbehaving browsers).
- Logs one line per violation; tested by `__tests__/csp-report.test.ts` (5 tests).

### IAM scopes for the Pi

The Pi standby reads from the same SSM tree, sends mail via the same SES
identity, and pulls the same Cognito user metadata as the cloud Lambda. See
[docs/iam.md](../aws/iam.md) for the full IAM principal map and the
permission-update path that doesn't require root keys.

## What's deliberately out of scope

| Topic | Why skipped |
|---|---|
| **CSRF tokens** | App uses Bearer tokens in `Authorization` header, not cookies. CORS allowlist further restricts cross-origin requests. CSRF surface is minimal. |
| **SRI on third-party scripts** | EspoCRM's tracking script is loaded dynamically by another EspoCRM loader. CSP allowlist already constrains the scripts that can run; SRI on Stripe/Sentry is feasible if needed. |
| **WAF / DDoS protection at edge** | Not currently configured. CloudFront's built-in DDoS protection (Shield Standard) is on by default. AWS WAF is the next step if needed. |
| **`'unsafe-inline'` / `'unsafe-eval'` in CSP** | Required by EspoCRM's tracking script. Removing them would break EspoCRM. CSP nonces could narrow this if EspoCRM is ever removed. |

## Verifying

```bash
# Headers on prod
curl -sI https://cloudless.gr/ | grep -iE "strict-transport|content-security|permissions|x-frame|x-content|referrer|report-to"

# CSP report endpoint reachable
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST https://cloudless.gr/api/csp-report \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"violated-directive":"test"}}'
# expect: HTTP 204

# Run the unit-test suite
pnpm exec vitest run __tests__/sentry-scrub.test.ts __tests__/csp-report.test.ts

# Dep vuln check
pnpm audit
```

## See also

- [docs/deploy.md](../deploy/deploy.md) — how production deploys and what IAM perms the deploy role has
- [docs/iam.md](../aws/iam.md) — IAM principals and the no-root permission-update path
- [docs/pi-cloud-sync.md](../deploy/pi-cloud-sync.md) — what's kept identical between the cloud and Pi apps
- [docs/SECURITY_ENHANCEMENTS_ROADMAP.md](SECURITY_ENHANCEMENTS_ROADMAP.md) — longer-horizon backlog
