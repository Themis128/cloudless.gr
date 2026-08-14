# Integration, data flow, and business logic

What the product **does** today (CRM, Stripe, analytics, AI, CMS, comms).
**Filter, not a rebuild.** Production origin is Pi Next.js behind `cloudless2`,
not OpenNext on Workers.

Code map: [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md).  
Lake: [`data/datalake-architecture-report.md`](data/datalake-architecture-report.md).  
Backlog: [`roadmap/agency-platform-backlog.md`](roadmap/agency-platform-backlog.md).

Config cascade: D1 `app_config` → `process.env` (k8s / local). AWS SSM is
legacy. Unconfigured integrations return **503** and must stay that way.

---

## 1. CRM (EspoCRM)

**Live:** `src/lib/espocrm.ts` (+ `espocrm-webhook.ts`, `espocrm-slack.ts`,
`espocrm-queue.ts`). Self-hosted on omv k3s. Auth: `X-Api-Key`. HubSpot is gone.

| Export | Behavior |
| --- | --- |
| `upsertContact` | Create/update Contact by email |
| `searchContacts` / `listContacts` | List / attribute search |
| `getContact` / related lists | Contact 360 (`opportunities`, `cases`, `notes`) |
| `createLead` / `countLeadsForCampaign` | Unqualified Lead + UTM / campaign slug |
| `createDeal` / `updateDeal` / `moveDealStage` / `getDealsByStage` / `getPipelineStats` | Opportunity pipeline |
| `associateDealWithContact` | M2M link |
| `createTicket` / `listTickets` | Case + priority map |
| `listCompanies` / `listOwners` | Account / User |
| `createNote` / `createContactNote` / `listNotes` | Stream posts |
| `listNewsletterSubscribers` / `setNewsletterStatus` | `leadSource = Email` |
| `isEspoCRMConfigured` | Health |

Entities: Contact, Account, Opportunity, Case, Lead, Note, User.

**UI:** `/admin/crm` (list), `/admin/crm/[id]` (360 join), companies, tickets,
`/admin/pipeline`, `/admin/leads`.

**Inbound:** `/api/contact` upserts contact, writes a note (score + NLP + UTM),
Slack + ActiveCampaign enroll for **every** submit. Opportunity is created
only when `lead.band === "hot"` (score ≥ 65).

Do not reintroduce HubSpot or a second CRM database.

---

## 2. E-commerce (Stripe)

| Module | Role |
| --- | --- |
| `stripe.ts` | `getStripe()`, recent sessions, products |
| `stripe-transactions.ts` | Idempotent D1 `stripe_transaction` + R2 NDJSON sink |
| `stripe-analytics-read.ts` | Snapshot including `dailyTrend` (no admin chart yet) |
| `store-products.ts` | Live Stripe catalog, 5-min cache, static fallback |
| Store components | Cart, grid, recommendation grid |

Flow: `/store` → `/api/checkout` → Stripe Checkout → `/api/webhooks/stripe` →
Slack `slackOrderNotify` + D1/R2. Admin: `/admin/orders`, `/admin/subscriptions`.
Recommendations: feature similarity + co-purchase (`product-recommendations.ts`).

Admin analytics revenue is **gold** (`getStripeSnapshotFromLake`), not a live
Stripe call on those pages.

---

## 3. Analytics / reporting

| Layer | Live behavior |
| --- | --- |
| D1 `analytics_events` | `analytics.ts` hot path (funnel + attribution overlay) |
| Analytics Engine | Edge latency / status / bytes |
| `notion-analytics.ts` | **Name leftover** — reads D1 only |
| R2 lake | Bronze parquet → gold JSON → `datalake-serve.ts` |
| DuckDB-Wasm | Explore catalog (9 of ~15 keys) |
| Orchestrator | LLM narrative + PDF (`analytics-report-pdf.ts`) |
| GSC | `gsc.ts` for **ETL/cache**; admin UI is gold |
| Cost | Frozen AWS snapshot |
| Ads | **LinkedIn adapter only**; Slack channel only |
| Workspace analytics | Portals + deliverables + calendar |
| `reports.ts` / client-reports cron | Logic exists; **admin Reports UI is missing** |

Insight domains: seo, revenue, crm_funnel, ads, ops_errors, executive,
orchestration.

Do not call live GSC/Stripe/Espo from `/admin/analytics/*`. Do not implement
Discord/email ad channels or extra ad adapters until gold ETL exists.

---

## 4. AI

**Cascade (admin text):** Workers AI (`@cf/meta/llama-3.1-8b-instruct`) → Gemini.

**Public chat (`/api/chat`):** Workers AI tool loop (`workers-ai-chat.ts`) —
`lookup_product`, `check_calendar_availability`, `book_slot`. `anthropic.ts`
is **not** the public chat path.

| Feature | Module |
| --- | --- |
| Admin generate | `admin-ai.ts` |
| NLP on contact | `nlp/analyze-lead.ts` (intent/entities/locale) |
| Booking agent | `agent-book.ts` (propose → confirm) |
| Voice brief | `agent-voice-brief.ts` |
| Analytics narrative | `analytics-agent-orchestrator.ts` |
| Admin assistant + RAG | `admin-assistant-tools.ts`, Vectorize |
| Product copy | `/api/admin/ai/product-descriptions` |
| LangGraph | **Stub** (`langgraph-client.ts`) — do not install SDK / Workers LangGraph |

Pages: `/admin/ai-assistant`, `ai-generator`, `langgraph`, `voice-brief`.

---

## 5. Content management

**Live CMS: AppFlowy** (`appflowy-*.ts`, `/admin/appflowy`, `/admin/cms/*`).
`cms-provider.ts` still lists Notion as temporary fallback — cleanup todo.

Notion `notion-*.ts` (~19 files) and `/admin/notion/*` pages are **debt**.
Analytics/Reports/GSC Notion DBs are already D1/R2. Calendar may still hit
Notion when `NOTION_CALENDAR_DB_ID` is set.

Public blog/docs/case-studies/FAQs/services/testimonials: AppFlowy then static.
Search: AppFlowy + Meilisearch (store). Content calendar: Postiz-oriented
types in `content-calendar.ts`.

---

## 6. Communication

**Slack** (`slack-notify.ts`): bookings, orders, errors (10-min dedupe),
deploys, contact (score + NLP + UTM), chat, tickets, registrations,
subscribers. Two Slack apps: `/api/slack/*` and `/api/newsletter-slack/*`.

**Email:** Cloudflare Email Service / Resend (`email.ts`). Newsletter
subscribe/send. ActiveCampaign optional (`enrollLeadInAutomation`).

**Postiz:** self-hosted social schedule; `/admin/postiz`; webhook + crons.

**ntfy / MQTT:** phone push and ESP32 — ops, not marketing channels.

Ad notification `email` / `discord` types are **unimplemented**. Slack only.

---

## 7. External services (graceful 503)

| Area | Live |
| --- | --- |
| CRM | EspoCRM |
| Pay | Stripe |
| CMS | AppFlowy (Notion leftover) |
| Email marketing | ActiveCampaign |
| Social | Postiz |
| Calendar / SEO ETL | Google Calendar, GSC |
| Ads poll | LinkedIn (others placeholders) |
| CAPI | Meta + LinkedIn when IDs set |
| AI | Workers AI, Gemini, optional Anthropic, AI Search, Vectorize |
| Automation | n8n |
| Monitor | Grafana, Prometheus, Kuma, Sentry |
| Infra | D1, R2, Tunnel, GitHub Actions |

~140 keys via `integrations.ts` / `ssm-config-d1.ts`. Never read `.env.local`.

---

## 8. Admin surface

Treat [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md) as the page list.
Corrections vs older “40+ sections” write-ups:

- CRM includes **`/admin/crm/[id]`**
- `/admin/notion/*` should go away
- `/admin/reports` UI is absent (cron/lib only); nav link removed
- `/admin/kpi` and `/admin/cost` are in Overview nav
- Analytics subpages are gold + D1 hot + AE + DuckDB

---

## 9. Extra business logic

**Lead score** (`lead-scoring.ts`): 0–100 — service (30), company (15),
message (25), attribution (20), business email (10), NLP (15). Bands:
hot ≥ 65, warm ≥ 35, cold. Already on Slack + CRM notes. `/api/contact`
opens an EspoCRM Opportunity only when the band is hot.

**Attribution** (`lead-attribution.ts`): first-touch UTM. Gold section
`attribution` on the datalake page; still to surface on contact 360.

**Portals** (`client-portals.ts`): D1-backed steps, deliverables, payments,
comments, monthly email opt-in. Health: `scoreClientHealth()`.

**Auth:** D1 sessions (`auth-d1.ts` + `api-auth.ts`). `[...nextauth]` is a
Cognito shim.

**Crons / webhooks:** as in the architecture map. `analytics-rollup` still
imports Notion-named D1 helpers.

---

## What this is (one line)

An agency OS: public site + Stripe store + EspoCRM + ads/email/social +
gold analytics + Workers AI agents + client portals + Pi observability.

Do **not** grow Notion, HubSpot, LangGraph-on-Workers, extra ad pollers,
Discord/email notifiers, or OpenNext-as-origin from this inventory.
