# Tooling that fits cloudless.gr — curated short-list

The full available-tooling catalogue runs ~200 connectors + ~175 skills.
This page is the **curated subset** that actually fits your stack:
solo Greek SMB operator, Cloudflare-edge primary + Pi/k3s self-hosted,
budget under $50/mo unless ROI is obvious. Everything else stays
installed-but-unauthenticated — no clutter, no bills.

**Filter rules applied:**

- Drop tools for the wrong region (US-only payroll/banking).
- Drop tools that overlap with what you already self-host (Zapier vs n8n, Cloudinary vs R2/Workers).
- Drop tools that decommissioned products use (HubSpot, Apollo, Notion, AWS).
- Drop tools whose value-proposition needs a team (Gong, Intercom for a 1-person op).
- Keep only what maps to a specific need on your roadmap or daily ops.

## 🟢 Use today — no setup (14 connectors)

| # | Tool | Why it fits |
|---|---|---|
| 1 | **Kubernetes_MCP_Server** | Every cluster-side change (Grafana plugin install, cloudflared edits, MQTT test) |
| 2 | **Windows-MCP (PowerShell)** | Every CLI command — gh / git / curl / node / kubectl |
| 3 | **Google Drive** | The 3rd canonical surface for all docs (per persistent rule) |
| 4 | **GitHub `gh` CLI** | PR create + merge cycle |
| 5 | **Sentry** | Auto-fire `notifyAdmin()` from incidents (already authenticated) |
| 6 | **Slack admin (slack-manager)** | Workspace channel/user ops |
| 7 | **PostHog** | Product analytics + session replay + feature flags + A/B |
| 8 | **SEMrush** | Pairs with your existing GSC ETL for the SEO funnel |
| 9 | **Bright Data** (skill-only) | Competitive pricing intel + brand-mention monitoring |
| 10 | **Cowork artifacts + present_files** | Persistent HTML pages + file-share cards in chat |
| 11 | **Visualize show_widget** | Inline mermaid diagrams (used for purchase-flow + system-map) |
| 12 | **Scheduled tasks** | Cron for daily/monthly probes |
| 13 | **Agent + WebSearch + WebFetch** | Multi-source research (the 2026 best-practices audit used this) |
| 14 | **Cloudflare** (via `cloudflare` MCP + API) | Workers/Pages/D1/R2/Access/token ops — the primary platform |

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
- `espocrm-operator` — CRM ops, API key rotation, Slack-sync, ETL, email bridge
- `appflowy-operator` — 9-pod stack + worker omv-ha pin
- `mqtt-auth-rollout` (+ `esphome-ota-flash`) — Mosquitto + ESP32 OTA
- `gh-actions-pitfalls` — 8 CI gotchas (read BEFORE every workflow edit)
- `linkedin-campaigns` (+ `linkedin-insight-doctor`) — Campaign + CAPI debugging
- `audit-routine` — weekly audit workflow
- `terraform-doctor` — Terraform plan/apply triage for `infrastructure/cloudflare-access/`

## 📦 Anthropic-installed skills (9 — what's actually relevant)

- **sst-nextjs** — your deploy pattern (SST → Cloudflare)
- **stripe-nextjs** — Checkout + webhooks + raw-body gotcha
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

- **HubSpot** (decommissioned — moved to EspoCRM)
- **Notion** (decommissioned — CMS is AppFlowy on omv k3s)
- **AWS / AWS_API_MCP_Server** (decommissioned — primary platform is Cloudflare)
- **Apollo** (removed PR #1080 — Greek SMB volume too low)
- **Cloudinary** (R2 + Workers image handling fits same-hardware rule)
- **Fastly / Vercel** (you're on Cloudflare)
- **Sanity** (AppFlowy covers CMS need)
- **Zapier** (n8n self-hosted covers automation)
- **Daloopa / Bigdata.com** (public-company financial research)
- **QuickBooks / Gusto / PayPal / Square / Shopify / Stripe-small-biz** (wrong region or wrong stack)
- **Microsoft 365** (Gmail covers this)
- **Zoom / Intercom / Gong** (team-scale tools, solo-op overkill)
- **Adobe CC / Figma / Canva / Miro** (useful for visuals — not blocking; activate if you ever need design work)

## Roadmap → tool mapping

Every TODO item ships with EXISTING tooling from the curated list above.
**No new install needed.** Historical R-series items that depended on
AWS (SSM scope assertion, Route 53 failover drill, multi-region) are
retired with the AWS decommission.

| TODO | Powered by |
|---|---|
| PVC backup | Kubernetes MCP + `cluster-bash` skill |
| TLS probe | built-in bash (curl + openssl) + Scheduled tasks |
| /admin/cost | Cloudflare usage APIs + `cloudflare` MCP |
| EspoCRM hourly | Kubernetes MCP + `espocrm-operator` skill |
| Sentry env tag | trivial config change |
| Cloudflare Access | `cloudflare-tunnel-ops` skill + `cloudflare` MCP |
| Kuma monitors | operator UI (could automate via Claude-in-Chrome) |
| Failover drill | `cloudflare` MCP (Load Balancing) + Scheduled tasks |
| AI baseline | Kubernetes MCP (Meilisearch) + Workers AI |
| Stripe idempotency | `stripe-nextjs` skill |
| Resend pilot | built-in (curl Resend API) — Resend is already the mailer |
| Social publishing | SocialAuto (cu130-slim) via `/api/admin/postiz` proxy |

## See also

- `docs/master-todo-list.md` — what this tooling powers
- `docs/architecture-purchase-flow.md` — what the tools assemble
- `docs/best-practices-audit-2026.md` — 2026 standards this tooling meets
