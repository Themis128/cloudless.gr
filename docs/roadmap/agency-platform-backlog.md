# Agency platform backlog

Filters (August 2026) — treat as **backlog filters**, not build plans:

- [Cloudless Platform Assessment rev. 2](https://claude.ai/code/artifact/7c1b2cf7-4f30-449d-acad-32aff8c37109)
- [Datalake and analytics architecture](../data/datalake.md)
- [Admin analytics UI — operator visibility](../data/admin-analytics-ui-report.md)
- [Structured documentation summary](../DOCUMENTATION-SUMMARY.md)
- Production edge: `.cursor/rules/cloudless2-pi-proxy.mdc`
- [Integration / data-flow / business logic](../BUSINESS-LOGIC-REPORT.md)

**Scope:** Cloudless is an agency operating system (marketing + CRM + light delivery). Do not build general-purpose ERP (HR, payroll, inventory, warehouse).

**Production edge stays:** `cloudless.gr` → Worker `cloudless2` (proxy only) → Pi Tunnel → k3s Next.js. App secrets live on the Pi pod. Do not extract Next.js into a UI shell + extra Workers, and do not put app secrets on `cloudless2`.

Ignore assessment lines that still say “offload to Workers for 100K req/day.” New D1 tables and API routes go **in the Next app**.

Percentages in the artifact (~75% marketing, ~60% CRM, ~15% ERP) are a snapshot, not targets.

---

## Do now (this week)

| Status          | Item                                                                                            | Why                                                                                                       | Notes                                                                |
| --------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Done (this branch)** | Unified admin contact page `/admin/crm/[id]`                                             | Highest-leverage CRM gap: EspoCRM, Stripe, and D1 are already populated; nothing joins them               | Join by email. No new database.                                      |
| **Done (this branch)** | Gate EspoCRM Opportunity create on lead score ≥ 65                                              | Contact form already scores leads and Slack already shows the score; every inbound currently opens a deal | Keep Slack + ActiveCampaign `enrollLeadInAutomation` for all inbound |
| **Done (this branch)** | Delete residual Notion fallback in `cms-provider.ts` and public CMS routes | CMS is AppFlowy; do not revive Notion admin/webhooks | `notion-*.ts` type files remain as AppFlowy re-export sources; leftover `/admin/notion/*` pages still a Wait |
| **Done (this branch)** | Surface gold `attribution` on the contact 360 page                                              | D1 UTM attribution already materializes in `admin-datalake.json`; no new dashboard                        | Join by email / campaign — do not build a CDP                        |

## Do next (after the contact page proves matching)

| Status | Item                                                  | Why                                                              | Notes                                                                       |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Wait   | Customer Data Platform (new D1 + identity resolution) | 4–6 weeks. Only if join-by-email on `/admin/crm/[id]` is painful | Do not start four new D1 databases up front                                 |
| Wait   | Marketing automation beyond ActiveCampaign            | Phase 2 in the artifact                                          | Use existing AC automations until the contact page shows gaps               |
| Wait   | Invoicing                                             | Agency-only finance                                              | Prefer Stripe Invoicing API before a custom D1 ledger / `finance-db` Worker |
| Wait   | Projects + time tracking                              | Agency delivery, not ERP                                         | After invoicing has a real operator workflow                                |
| Wait   | EspoCRM D1 cache                                      | Latency, not a new CRM                                           | After Notion adapters are gone                                              |
| Wait   | Docs / contracts                                      | Phase 6                                                          | AppFlowy already hosts docs; do not add `docs-db` as a Worker               |
| Wait   | AI agents on Cloudflare Workers                       | Artifact Phase 7                                                 | Keep LangGraph / Bedrock on the Pi app path                                 |

## Explicitly out of scope

- HR, payroll, inventory, warehouse, manufacturing
- Finance Worker, `finance-db`, `project-db`, `docs-db` as separate services
- Rewriting the Next app into a BFF + extra Workers
- LangGraph on Cloudflare Workers
- Reviving Notion admin routes (`src/app/api/admin/notion/**`) or HubSpot surfaces

---

## Contact 360 — first slice

**Route:** `GET /api/admin/crm/contacts/[id]` (admin session)  
**Page:** `/[locale]/admin/crm/[id]`

Joins, all optional except EspoCRM contact:

1. EspoCRM Contact + related Opportunities, Cases, Notes
2. Stripe customer / checkout sessions / subscriptions by email
3. D1 `user` row by email
4. D1 `analytics_events` where `user_id` matches or `properties_json.email` matches

Matching is email-only. If that fails in production, _then_ consider a CDP.

---

## Datalake / analytics — filter

Architecture: [`docs/data/datalake.md`](../data/datalake.md).
The lake already exists (ETL → R2 parquet → gold JSON → `datalake-serve.ts`).
Do **not** rebuild medallion, stand up BI SaaS, or call live GSC/Stripe/Espo from admin pages.

### Do now (lake hygiene)

| Status | Item | Why | Notes |
| --- | --- | --- | --- |
| **Done (this branch)** | Expand DuckDB explore catalog to remaining bronze keys | Parquet already lands for n8n executions, Postiz, AppFlowy, churn, portals; explore UI only allowlists 9 datasets | `src/lib/lake-parquet-catalog.ts` |
| **Done (this branch)** | Retire Notion from `/api/cron/analytics-rollup` | Still imports `createWeeklyRollup` / `archiveOldEvents` from `notion-analytics.ts` | Cron now summarizes D1 `analytics_events` |
| **Done (this branch)** | Rename `notion-gsc-reports.ts` (R2 `gsc-weekly.json` reader) | Filename and SEO page comments still say Notion | Now `gsc-weekly-archive.ts` |
| **Done (this branch)** | Fix stale comments: DynamoDB bookmarks, S3 fallback, “live GSC” on gsc-archive | Ad poll uses D1 `ad_analytics_bookmark`; `analytics-r2.ts` has no S3 path | Docs only unless a code path still hits AWS |

### Do next (after contact 360)

| Status | Item | Why | Notes |
| --- | --- | --- | --- |
| Wait | Overlay RFM / churn parquet on `/admin/crm/[id]` | Scores are already keyed by email in `ml-parquet/` | Join-only; still not a CDP |
| Wait | GSC dimension ETL (country / device / page) | `getGscDimensionFromLake` only has `query` rows; SEO tabs are stubs | Hide empty tabs until ETL exists |
| Wait | LinkedIn-only ROI → other ad channels in gold | `getRoiFromLake` reports `configured=false` for Google/TikTok/X/Meta | Keep `roi.ts` live adapters off admin routes |
| Wait | R2 Data Catalog / R2 SQL | Optional explore SQL without Athena | Dashboards stay on gold snapshots (`datalake.md`) |

### Lake out of scope

- A dedicated silver rewrite layer (bronze parquet already is silver)
- QuickSight / Power BI / Tableau / Looker / Metabase as operated products (orchestrator payloads only)
- Athena, Glue, or live vendor APIs on `/admin/analytics` page load
- DynamoDB bookmarks (already D1)
- AWS S3 fallback for events or ETL

---

## Admin analytics UI — filter

Operator map: [`docs/data/admin-analytics-ui-report.md`](../data/admin-analytics-ui-report.md).
The dashboards already exist. Prefer wiring data the APIs already return over new pages.

### Do now (operator visibility)

| Status | Item | Why | Notes |
| --- | --- | --- | --- |
| **Done (this branch)** | Fix admin nav: remove or restore `/admin/reports`; link `/admin/kpi` and `/admin/cost` | Reports is a dead link; KPI and Cost pages exist but are not in `AdminLayoutClient` | No new dashboards |
| **Done (this branch)** | Relabel SEO weekly archive + workspace calendar away from Notion | Archive is R2 gold; calendar is in-memory (no Notion fallback) | Calendar no longer writes to Notion |
| **Done (this branch)** | Add a thin admin view for `GET /api/admin/analytics/search-funnel` | Funnel events land in D1; only `getFunnelSummary()` exists — no page | `/admin/analytics/funnel` |

### Do next (charts on existing payloads)

| Status | Item | Why | Notes |
| --- | --- | --- | --- |
| Wait | Sparkline / daily bars on Unified + Stripe `dailyTrend` | `stripe-analytics-read.ts` already computes per-day revenue; unified is point-in-time cards | Reuse History-tab SVG pattern |
| Wait | Anomaly history table in admin | Five rules already fire to Slack only | Read D1 bookmarks / a small log; no alerting-config UI |
| Wait | CSV export on datalake section tables | Operators already have gold tables with no download | After contact 360 |
| Wait | Funnel `ab_variant` comparison | `/admin/ab-tests` toggles flags; it does not show funnel results | Distinct from flag admin |
| Wait | Restore client reports with gold sections (GSC / Stripe) | Only if `/admin/reports` is restored | Do not invent a report product first |

### UI out of scope

- Drag-and-drop / customizable widgets / period-over-period builder
- Cohort and retention product analytics
- Real-time event stream
- Discord or email notification channels (Slack is the channel)
- Admin forms for GSC secrets, LinkedIn CAPI IDs, or anomaly thresholds
- Unfreezing AWS Cost Explorer
- Per-workspace ad spend + SEO warehouse

---

## Documentation — filter

Inventory: [`docs/DOCUMENTATION-SUMMARY.md`](../DOCUMENTATION-SUMMARY.md).
Live checklist: `.cursor/rules/cloudless2-pi-proxy.mdc` plus this backlog.
Prefer `.cursor/rules/` over AWS-primary / Cognito / HubSpot / Notion-CMS runbooks.

### Do now (doc hygiene)

| Status | Item | Why | Notes |
| --- | --- | --- | --- |
| **Done (this branch)** | Add `docs/current-source-of-truth-checklist.md` | Architecture skill and `CLAUDE.md` linked a missing file | Points at `cloudless2` → Pi, AppFlowy, D1, EspoCRM |
| **Done (this branch)** | Banner `docs/integrations/HUBSPOT.md` + integrations README as EspoCRM | File still documents `hubspot.ts` / `HUBSPOT_API_KEY` | Do not revive HubSpot |
| **Done (this branch)** | Banner `docs/integrations/NOTION-CMS.md` as archive | Live CMS is AppFlowy | Keep file; do not rewrite as a Notion how-to |
| **Done (this branch)** | Redirect leftover `/admin/notion/*` pages | Parallel Notion admin UI still exists; **no** `src/app/api/admin/notion/**` | Redirects to `/admin/appflowy/*`; CMS types/static live in `cms-static.ts` |
| **Done (this branch)** | Fix EspoCRM README “ETL to S3” → R2 parquet | `scripts/etl/espocrm-to-r2.mjs` is the path | `infrastructure/espocrm/README.md` |
| **Done (this branch)** | Replace `search_notion` in `ANTHROPIC.md` / `AGENTS_ROADMAP.md` | Admin assistant is AppFlowy | Same CMS rule |

### Doc out of scope

- Recreating `CLOUDFLARE-ARCHITECTURE.md` / `HA-ARCHITECTURE.md` as long essays (`ARCHITECTURE.md` is a stub; use the map + checklist)
- Operating from `docs/deploy/pi-cloud-sync.md` (AWS dual-home) or Cognito `docs/auth/`
- Restarting `ROADMAP-ONE-STOP-SHOP.md` as a greenfield 4-phase build
- Expanding AWS from migration skills except to retire leftovers
- Treating OpenNext / Workers as the Next.js origin (map overview is wrong; production is `cloudless2` proxy → Pi)
- Growing `/api/auth/[...nextauth]` or `/admin/notion/*`

---

## Business logic — filter

Flows: [`docs/BUSINESS-LOGIC-REPORT.md`](../BUSINESS-LOGIC-REPORT.md).
The capabilities already exist. Do not rebuild CRM, Stripe, lake, or AI from
that inventory.

Corrections vs the raw report:

- Public `/api/chat` is **Workers AI**, not Anthropic
- CMS is **AppFlowy primary**, not Notion primary
- Ad poll adapter registry is **LinkedIn + Slack only**
- Admin analytics GSC is **gold**, not live `gsc.ts`
- Contact form already scores + NLP + Slack; Opportunity is created when `lead.band === "hot"` (score ≥ 65)
- Client Reports **cron/lib exist**; admin Reports UI does not (nav link removed; KPI + Cost are in Overview)

No new product work from this report beyond todos already listed (contact 360
attribution, Notion cleanup, deal gating, lake/UI hygiene).
