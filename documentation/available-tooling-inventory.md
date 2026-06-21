# Tooling that fits cloudless.gr — curated short-list

The full available-tooling catalogue runs ~200 connectors + ~175 skills.
This page is the **curated subset** that actually fits your stack:
solo Greek SMB operator, AWS-serverless primary + Pi-cluster failover,
budget under $50/mo unless ROI is obvious. Everything else stays
installed-but-unauthenticated — no clutter, no bills.

**Filter rules applied:**
- Drop tools for the wrong region (US-only payroll/banking).
- Drop tools that overlap with what you already self-host (Zapier vs n8n, Cloudinary vs S3+Lambda).
- Drop tools that decommissioned products use (HubSpot, Apollo).
- Drop tools whose value-proposition needs a team (Gong, Intercom for a 1-person op).
- Keep only what maps to a specific need on your roadmap or daily ops.

**Total: 20 connectors + 23 skills.**

## 🟢 Use today — no setup (16 connectors)

| # | Tool | Why it fits |
|---|---|---|
| 1 | **Kubernetes_MCP_Server** | Every cluster-side change (used 50× today: Grafana plugin install, SSM bootstrap, cloudflared edits, MQTT test) |
| 2 | **Windows-MCP (PowerShell)** | Every CLI command — aws / gh / git / curl / node / kubectl |
| 3 | **Google Drive** | The 3rd canonical surface for all docs (per persistent rule) |
| 4 | **Notion** | Read your existing blog / docs / tasks DBs |
| 5 | **GitHub `gh` CLI** | PR create + merge cycle (all R-series + hotfixes) |
| 6 | **AWS_API_MCP_Server** | `call_aws` for R18 SSM scope assertion + R19 Route 53 failover drill + R24 multi-region |
| 7 | **Sentry** | Auto-fire `notifyAdmin()` from incidents (already authenticated) |
| 8 | **Slack admin (slack-manager)** | Workspace channel/user ops |
| 9 | **PostHog** | Product analytics + session replay + feature flags + A/B for R21c rec engine |
| 10 | **SEMrush** | Pairs with your existing GSC ETL for the SEO funnel |
| 11 | **Postiz** (skill-only) | Social scheduling (no MCP auth needed — direct REST via `src/lib/postiz.ts`) |
| 12 | **Bright Data** (skill-only) | Competitive pricing intel + brand-mention monitoring |
| 13 | **Cowork artifacts + present_files** | Persistent HTML pages + file-share cards in chat |
| 14 | **Visualize show_widget** | Inline mermaid diagrams (used for purchase-flow + system-map) |
| 15 | **Scheduled tasks** | Cron for the R11 / R18 / R19 daily/monthly probes |
| 16 | **Agent + WebSearch + WebFetch** | Multi-source research (the 2026 best-practices audit used this) |

## 🟡 Authorize via 1-click URL (2 connectors)

| # | Tool | Why |
|---|---|---|
| 17 | **Slack (by Salesforce)** | Rich search across your full Slack history — cross-channel digests, finding past decisions |
| 18 | **Brand Voice / Granola** *(only if you actually use Granola for meeting notes)* | Auto-extract brand voice from real conversations |

## 🟡 `/mcp` manual setup (2 connectors, Google ecosystem)

| # | Tool | Why |
|---|---|---|
| 19 | **Google Calendar** | Booking-flow surface on the site (consultations, demos) |
| 20 | **Gmail** | Inbox triage + customer email search |

## 📚 In-repo skills (10 — the ones you'll actually invoke)

These are YOUR canonical operator playbooks under `skills/`. Per memory
`feedback_use_in_repo_skills` they MUST be read before solving from
first principles. Top 10 most-load-bearing for cloudless.gr build:

- `selfhosted-admin-bootstrap` — add unified admin to any new app
- `cloudflare-tunnel-ops` — ingress + DNS without operator dashboard
- `cloudflare-token-doctor` — token rotation flow (Phase 0 prereq)
- `espocrm-operator` — CRM ops, API key rotation, Slack-sync, ETL, SES bridge
- `appflowy-operator` — 9-pod stack + worker omv-ha pin
- `postiz` (+ `postiz-doctor`) — Posting + OAuth troubleshooting
- `mqtt-auth-rollout` (+ `esphome-ota-flash`) — Mosquitto + ESP32 OTA
- `gh-actions-pitfalls` — 8 CI gotchas (read BEFORE every workflow edit)
- `linkedin-campaigns` (+ `linkedin-insight-doctor`) — Campaign + CAPI debugging
- `audit-routine` — weekly audit workflow

## 📦 Anthropic-installed skills (13 — what's actually relevant)

- **sst-nextjs** — your AWS stack pattern
- **stripe-nextjs** — Checkout + webhooks + raw-body gotcha (R22 audit)
- **aws-ssm-config** — SSM caching in Lambda (your runtime config pattern)
- **aws-ses-nextjs** — SES sendEmail + suppression list
- **cognito-amplify-nextjs** — Cognito JWT verify on API routes
- **notion-nextjs** — Notion-as-CMS in Next.js (in use)
- **slack-nextjs-integration** — Slack from a Next.js app (webhooks, OAuth, signing)
- **sentry-nextjs** — Sentry in App Router
- **gsc-nextjs** — Google Search Console queries (in use)
- **vitest-playwright** — your test framework
- **docx / xlsx / pptx** — client deliverables
- **theme-factory** — 10 ready themes for HTML artifacts
- **schedule** — persistent cron-style scheduled tasks

## Persistent skip list (no action needed)

These stay installed-but-unauthenticated — available if you ever need
them, but no setup time spent now:

- **HubSpot** (decommissioned 2026-06-20, moved to EspoCRM)
- **Apollo** (removed PR #1080 — Greek SMB volume too low)
- **Cloudinary** (Lambda image-resize fits same-hardware rule)
- **Fastly / Vercel** (you're on AWS+Cloudflare)
- **Sanity** (Notion + AppFlowy cover CMS need)
- **Zapier** (n8n self-hosted covers automation)
- **Daloopa / Bigdata.com** (public-company financial research)
- **QuickBooks / Gusto / PayPal / Square / Shopify / Stripe-small-biz** (wrong region or wrong stack)
- **Microsoft 365** (Gmail covers this)
- **Zoom / Intercom / Gong** (team-scale tools, solo-op overkill)
- **Adobe CC / Figma / Canva / Miro** (useful for visuals — not blocking; activate if you ever need design work)

## R10-R24 roadmap → tool mapping

Every TODO item ships with EXISTING tooling from the curated list above.
**No new install needed.**

| TODO | Powered by |
|---|---|
| R10 PVC backup | Kubernetes MCP + `cluster-bash` skill |
| R11 TLS probe | built-in bash (curl + openssl) + Scheduled tasks |
| R12 /admin/cost | existing `src/lib/athena.ts` |
| R13 EspoCRM hourly | Kubernetes MCP + `espocrm-operator` skill |
| R14 Sentry env tag | trivial config change |
| R15 Cloudflare Access | `cloudflare-tunnel-ops` skill (needs Phase 0 token) |
| R17 Kuma monitors | operator UI (could automate via Claude-in-Chrome) |
| R18 SSM scope assertion | AWS_API_MCP + Scheduled tasks |
| R19 Failover drill | AWS_API_MCP (Route 53) + Scheduled tasks |
| R21 AI baseline | Kubernetes MCP (Meilisearch) + existing Bedrock IAM |
| R22 Stripe idempotency | `stripe-nextjs` skill |
| R23 Resend pilot | built-in (curl Resend API) |
| R24 Multi-region | AWS_API_MCP (Route 53 + DDB Global Tables) |

## See also

- `docs/master-todo-list.md` — what this tooling powers
- `docs/architecture-purchase-flow.md` — what the tools assemble
- `docs/best-practices-audit-2026.md` — 2026 standards this tooling meets
