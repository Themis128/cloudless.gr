# cloudless.gr — Complete Use-Case Catalog

Everything the platform can do, grouped by who does it and where. Each entry
names the surface (page or API) and, where relevant, what must be configured
for it to be live. Status legend: **live** (works with current config),
**needs config** (code is merged; one SSM key / external setup activates it).

Last verified against the codebase: 2026-06-12.

---

## 1. Visitors — the public website

| Use case | Surface | Status |
|----------|---------|--------|
| Learn about the company and services | `/`, `/services`, `/work` | live |
| Read marketing content (blog) | `/blog`, `/blog/[slug]` — Notion-backed | live |
| Read documentation | `/docs`, `/docs/[slug]` — Notion-backed | live |
| Browse case studies and social proof | `/case-studies`, testimonials across pages — Notion CMS with static fallback | live |
| Contact the company | `/contact` form → SES email + auto-reply, HubSpot contact + deal, Notion submission, Slack alert | live |
| Get scored as a lead invisibly | First-touch UTM/referrer capture site-wide → lead score 0–100 on submission | live |
| Buy a product or service | `/store`, `/store/[id]` → Stripe checkout → `/store/success` | live |
| Book a consultation | Chat widget / calendar booking → Google Calendar + Meet link, Slack alert | live |
| Subscribe to the newsletter | Subscribe form → HubSpot list, unsubscribe flow | live |
| Sign up and pick a plan | `/auth/signup` (Cognito) → plan selection → `/portal/waiting` | live |
| Use the site in 4 languages | `en`, `el`, `fr`, `de` locale routing everywhere | live |
| Chat with an AI assistant | Chat widget (Bedrock/Anthropic backed) | live |

## 2. Clients — the portal (the front-end promise)

| Use case | Surface | Status |
|----------|---------|--------|
| Follow project progress | `/portal/[token]` — step timeline with statuses and team comments | live |
| Review deliverables | Portal Deliverables section — items the team marks "in review" | live |
| Approve or request changes | Approve ✓ / Request changes buttons (comment required for changes); owner notified via Slack + email | live |
| Pay for project milestones | Portal Payments section — Stripe payment links with Pay now | live |
| See paid invoices and subscriptions | Auto-pulled from Stripe by client email | live |
| Receive a monthly status email | Cron `client-reports` (timeline, pending reviews, open payments, portal link) — per-portal opt-in | live, scheduled monthly |
| Wait-room after signup | `/portal/waiting` until the admin approves and provisions the portal | live |
| Customer account dashboard | `/dashboard` (profile, purchases, consultations, settings) | live |

## 3. Owner — lead engine (Phase 1)

| Use case | Surface | Status |
|----------|---------|--------|
| See every lead in one inbox | `/admin/leads` — HubSpot contacts + portal enrollments merged by email | live |
| Know where each lead came from | First-touch attribution (UTM, referrer, landing page) in HubSpot notes & Slack | live |
| Know which leads are hot | Explainable 0–100 score (service interest, company, message signals, paid traffic, business email) with 🔥/🌤️/❄️ bands | live |
| Get instant lead alerts | Slack message with score, band, attribution per submission | live |
| Auto-follow-up new leads | ActiveCampaign automation enrollment on submission | needs config: `ACTIVECAMPAIGN_LEAD_AUTOMATION_ID` in SSM |
| Manage the sales pipeline | `/admin/pipeline` — HubSpot deals by stage | live |
| Manage CRM records | `/admin/crm` (+ companies, tickets), `/admin/hubspot` | live |

## 4. Owner — marketing & publishing (Phase 2)

| Use case | Surface | Status |
|----------|---------|--------|
| Plan content across channels | `/admin/calendar` — social/email/blog/ad items, Notion-backed | live |
| Publish social posts with one click | Calendar draft → Postiz → Facebook, Instagram, LinkedIn, X, TikTok | needs config: deploy Postiz (`infrastructure/postiz/`, `docs/POSTIZ.md`) + `POSTIZ_API_URL`/`POSTIZ_API_KEY` |
| Monitor ad campaigns per platform | `/admin/campaigns` hub + Meta, Google, LinkedIn, TikTok, X detail pages with insights | live where platform tokens exist in SSM |
| Generate marketing copy with AI | `/admin/ai-generator` (Workers AI), `/admin/ai-assistant`, `/admin/voice-brief` | live |
| Run email campaigns | `/admin/email`, `/admin/email/campaigns` — ActiveCampaign | live where AC configured |
| Track SEO | `/admin/analytics/seo`, keywords/pages/devices/countries reports (GSC) | live |
| Retarget site visitors | Meta Pixel + Conversions API events (Lead, Contact, Purchase) with dedup | live |

## 5. Owner — client delivery (Phase 3)

| Use case | Surface | Status |
|----------|---------|--------|
| Approve a signup into a portal | `/admin/client-portals` Pending Clients → one-click approve creates the portal + welcome email | live |
| Run a project timeline | Steps with statuses, comments visible to the client | live |
| Share deliverables for sign-off | Add link (Figma/staging/doc) → set "in review" → client sees it | live |
| Get notified on client decisions | Slack + email on approve / request-changes | live |
| Bill per milestone | Attach Stripe payment links per portal; track open/paid/void | live |
| Send monthly client reports | Per-portal toggle; cron emails the summary | live, scheduled monthly |
| Spot at-risk clients | Health score 0–100 per portal (blocked steps, staleness, stuck reviews, aging payments) | live |

## 6. Owner — unified intelligence (Phase 4)

| Use case | Surface | Status |
|----------|---------|--------|
| See spend → leads → revenue in one view | `/admin/analytics/unified` Campaign ROI section: blended cost-per-lead + ROAS + per-channel table | live (fills in as platforms are configured) |
| One dashboard for the whole business | `/admin` command center: action queue, quick actions, live KPIs, complete grouped navigation | live |
| Weekly business digest in Slack | Cron `owner-digest`: new leads, content published, reviews pending, open payments, at-risk clients | live, scheduled Mondays 06:00 UTC |
| Cross-source KPI view | `/admin/kpi` (GSC + Notion analytics + projects + tasks), `/admin/analytics/unified` (SEO/revenue/pipeline/email) | live |
| Track site analytics | `/admin/notion/analytics` event tracking, `/admin/analytics/web` | live |
| Run A/B tests | `/admin/ab-tests` | live |

## 7. Owner — website management (CMS)

| Use case | Surface | Status |
|----------|---------|--------|
| Edit case studies, services, testimonials, FAQs | `/admin/cms/*` in-app CRUD (Notion-backed, static fallback) | live; Notion DBs need re-sharing with the integration (see Pending One-Time Setup in CLAUDE.md) |
| Manage blog and docs | `/admin/blog`, `/admin/docs` | live |
| Review contact submissions | `/admin/notion` (submissions) | live |
| Manage store orders & subscriptions | `/admin/orders`, `/admin/subscriptions` | live |
| Manage user accounts | `/admin/users` (Cognito) | live |
| Track projects & tasks | `/admin/projects`, `/admin/notion/projects`, `/admin/notion/tasks` | live |

## 8. Automations (no human in the loop)

| Automation | Trigger | Status |
|------------|---------|--------|
| Lead capture fan-out (email, HubSpot, Notion, Slack, Meta CAPI, AC enrollment) | Contact form submit | live |
| Weekly owner digest → Slack | GH Actions `platform-crons.yml`, Mon 06:00 UTC | live |
| Monthly client status emails | GH Actions `platform-crons.yml`, 1st 08:00 UTC | live |
| Daily content-calendar digest → Slack | Cron `calendar-digest` | endpoint live; schedule externally if wanted |
| Analytics rollup / report cleanup / voice brief / Slack digest | Other `/api/cron/*` endpoints | endpoints live |
| Stripe order fulfillment + notifications | Stripe webhooks | live |
| Auto-deploy to Pi cluster + AWS Lambda | Push to `main` | live |
| Nightly Pi disk cleanup, SHA-drift watchdog, HTTPS health probes, cert checks | systemd timers + scheduled workflows | live |

## 9. Operations & infrastructure (admin)

| Use case | Surface | Status |
|----------|---------|--------|
| Watch integration health | `/admin/integrations` — live status of every external service | live |
| Monitor errors | `/admin/errors` (Sentry unresolved issues, resolve/ignore) | live |
| Monitor the Pi cluster | `/admin/monitor`, `/admin/esp32`, `/admin/esp32-manager`, Grafana/Cluster Manager links | live |
| Route Slack notifications | `/admin/notifications` | live |
| Multi-workspace contexts | `/admin/workspaces` | live |
| HA failover (CloudFront ↔ Pi origin) | Cloudflare LB + health probes | needs config: `CLOUDFLARE_API_TOKEN` (see CLAUDE.md) |

---

## Activation checklist (everything not yet "live")

1. **Postiz** — deploy to k3s per `docs/POSTIZ.md`, connect social channels, set `POSTIZ_API_URL` + `POSTIZ_API_KEY` in SSM → unlocks one-click social publishing.
2. **`ACTIVECAMPAIGN_LEAD_AUTOMATION_ID`** in SSM → unlocks automated lead follow-up sequences.
3. **Ad platform tokens** in SSM (`META_ACCESS_TOKEN`+`META_AD_ACCOUNT_ID`, Google Ads, LinkedIn, TikTok, X) → fills campaign insights and the ROI view per channel.
4. **Slack delivery for the digest** — ensure `SLACK_BOT_TOKEN`/`SLACK_WEBHOOK_URL` are in production SSM (the digest computes correctly; delivery returned `sent:false` on the first live test).
5. **Notion CMS databases** — re-share the case-studies/testimonials/services/FAQs DBs with the "Cloudless.gr App" integration (Notion UI action).
6. **`CLOUDFLARE_API_TOKEN`** → HA load balancing + email-obfuscation fix workflows.

Everything in this catalog degrades gracefully until its config exists — no
surface errors out because an integration is missing.
