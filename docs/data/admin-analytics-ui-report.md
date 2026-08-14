# Admin analytics UI — operator visibility

What the operator can see today, what is queryable, what is auto-generated,
and what is missing. Filter (not a rebuild):
[`../roadmap/agency-platform-backlog.md`](../roadmap/agency-platform-backlog.md).

Lake serving rules: [`datalake-architecture-report.md`](datalake-architecture-report.md).
Admin analytics pages that talk to `/api/admin/analytics/*` (except Engine and
workspaces) are **gold / D1 hot**, not live GSC/Stripe/Espo on page load.

---

## 1. What the operator currently sees

Ten surfaces (seven under `/admin/analytics`, plus KPI and cost in Overview;
client Reports UI is absent — cron/lib only). Shared primitives: `CampaignPageKit`, `AdminAiUsageCard`.

### A. Main GSC dashboard — `/admin/analytics`

`src/app/[locale]/admin/analytics/page.tsx`

Five tabs, date range 7d / 28d / 90d / 180d (localStorage). APIs are
**gold** (`getSeoFromLake` / `getCtrOpportunitiesFromLake` / dimension stubs).

| Tab | What |
| --- | --- |
| Overview | Clicks, impressions, CTR, avg position + organic-search summary row |
| Keywords | Top 50 queries; CTR and position color bands (≤3 green, ≤10 cyan, ≤20 yellow) |
| Top Pages | Top 25 landing pages by clicks (path-only URLs) |
| History | SVG sparkline + weekly table (4–26 weeks) |
| CTR Opportunities | Rank 4–20, CTR &lt; 5%, “potential” clicks if CTR hit 5%; badge on the tab |

`src/lib/gsc.ts` still exists for **ETL / cache warming**, not this page’s
fetch path.

### B. SEO deep dive — `/admin/analytics/seo`

Six parallel calls: seo, query-pages, search-intent, countries, devices,
gsc-archive.

- KPI cards (clicks, impressions, CTR, position, keyword count)
- Intent buckets: Brand (`/cloudless/`), Product, Informational, Navigational
- Top keywords, query-to-page map (cannibalization), countries, devices
- Weekly archive: **R2** `lake/snapshots/gsc-weekly.json` (UI/comments may
  still say Notion). Dimension tables are stubs until GSC dimension ETL exists.

### C. Analytics Engine — `/admin/analytics/engine`

Cloudflare AE SQL explorer (edge latency). Shows the query + rows. Empty
state when no beacons. Needs `CLOUDFLARE_ACCOUNT_ID` + API token.

### D. Datalake dashboard — `/admin/analytics/datalake`

Gold `admin-datalake.json` + D1 hot overlay. Eleven sections, source badge
`GOLD SNAPSHOT` / `HOT D1 ONLY` / `EMPTY`, `generated_at`, Reload + Re-read.

| Section | Source | Columns (operator-facing) |
| --- | --- | --- |
| Acquisition funnel (30d) | D1 hot | day, sessions, signups, purchasers, revenue |
| Attribution (UTM) | D1 hot | utm_source, medium, campaign, sessions, purchases, revenue |
| GSC top keywords | gold | query, clicks, impressions, CTR, avg_position |
| LinkedIn ads (90d) | gold | campaign, impressions, clicks, CTR, spend, conversions, CPC, CPA |
| Top Sentry errors (14d) | gold | short_id, title, level, count_14d, users, last_seen |
| EspoCRM lifecycle | gold | lifecycle_stage, lead_source, contacts, won_deals, revenue |
| Stripe revenue | gold | metric, count, amount_EUR |
| n8n / Postiz / AppFlowy | gold | metric, value |
| ETL freshness | gold | source_key, exists, last_ETL, bytes |

This is the **canonical operator lake view**. Attribution already lives here —
do not build a second attribution dashboard.

### E. Lake Explore — `/admin/analytics/explore`

DuckDB-Wasm over catalog-allowlisted parquet (`analytics-client.ts` →
`/api/admin/analytics/lake-parquet?id=`). Default `SELECT * FROM lake LIMIT 50`.
Catalog currently 9 datasets (see architecture report).

### F. Unified dashboard — `/admin/analytics/unified`

`/api/admin/analytics/unified` + `/roi` — **gold composed**, not live Espo/GSC.

Sections: Campaign ROI (LinkedIn real; other channels `configured=false`),
Revenue, Search, Sales pipeline, Email marketing. Point-in-time KPI cards —
no trend charts.

### G. Workspace analytics — `/admin/analytics/workspaces`

Joins workspaces + client portals + **content calendar**
(`workspace-analytics.ts` / `content-calendar.ts`). Calendar still falls
through to Notion when `NOTION_CALENDAR_DB_ID` is set (in-memory store
otherwise). Per-workspace: portals (health via `scoreClientHealth`),
deliverables, payment-link revenue, calendar. Org-wide bucket for rows
without `workspaceId`. No ad spend or SEO per workspace.

### H. KPI — `/admin/kpi`

API is lake gold (`getKpiFromLake` + `appflowy_activity` + executive insight).
Legacy Notion site-analytics / task KPIs are decommissioned in the route.
**In Overview nav** (`AdminLayoutClient`).

### I. Client reports — `/admin/reports`

**Removed from admin nav and campaigns quick links (August 2026).** Cron/lib
(`reports.ts`, client-reports cron) still exist; there is no
`src/app/[locale]/admin/reports/` page. Do not restore or invent report
sections until an operator asks. KPI is the operator substitute in Overview.

### J. AWS cost — `/admin/cost`

Frozen Cost Explorer snapshot (D1 `aws_cost_daily` / R2 `cost.json`). 30d
total, yesterday vs 7d avg (color bands), daily bars, top services.
**In Overview nav.**

### K. Shared components

- `AdminAiUsageCard` — Workers AI / Gateway / Gemini / call counts / queues
- `CampaignPageKit` — BackLink, MetricCard, Spinner, ErrorMsg

A/B **flag** toggles live at `/admin/ab-tests` (not funnel `ab_variant`
results). Funnel summary API exists (`GET /api/admin/analytics/search-funnel`)
with **no dedicated admin page**.

---

## 2. What data is queryable

| Source | Path | Freshness (operator) |
| --- | --- | --- |
| GSC (admin UI) | Gold via `datalake-serve` | ETL snapshot, not live API |
| GSC (ETL / `gsc.ts`) | Search Console API + D1 cache (`gsc-cache.ts`, 1h / 24h stale) | Cron-warmed; not page load |
| GSC weekly archive | R2 `gsc-weekly.json` (`gsc-weekly-archive.ts`) | Weekly materialize |
| Stripe (admin unified) | Gold `stripe_revenue` | ETL |
| Stripe (D1 read helper) | `stripe-analytics-read.ts` (`dailyTrend` computed, **no admin chart**) | Live D1 if used |
| Search funnel | D1 `search_funnel_events` / `getFunnelSummary` | Live writes; API only |
| Funnel beacons | `POST /api/analytics/track` (`funnel-client.ts`, consent-gated) | Real-time ingest |
| Workspaces | SSM workspaces + portals + calendar | Live join |
| LinkedIn ads | Adapter + 15-min poll; gold for admin ROI | Poll / ETL |
| Ad anomalies | `anomaly.ts` — Slack only | Every poll |
| R2 gold / bronze | Datalake dashboard / DuckDB explore | ETL / on-demand |
| Analytics Engine | `/admin/analytics/engine` | Near real-time |
| AWS cost | Frozen D1 / R2 | Retired ETL |
| EspoCRM (admin analytics) | Gold `espocrm_funnel` on unified/datalake | ETL — CRM **pages** still live Espo |
| AppFlowy activity | Gold section / KPI | ETL |

---

## 3. What insights are auto-generated

| Insight | Mechanism | Destination |
| --- | --- | --- |
| CTR opportunities | Rank 4–20, CTR &lt; 5%, potential uplift | Analytics CTR tab |
| Search intent | Regex buckets in `getSearchIntentBreakdown` | SEO page |
| Query–page map | Cannibalization table | SEO page |
| Ad anomalies | 5 rules: CPC spike 1.4×, CPC ceiling, CTR floor 0.3%, zero conversions while spending, spend pace 1.5× | Slack DM |
| Ad digest + deltas | 15-min snapshot vs bookmark | Slack |
| ICP demographics | LinkedIn pivots (industry, seniority, title, company size), top-6 | Slack digest |
| Conversion pings | UTM, CAPI, EspoCRM deep-link | Slack |
| Anomaly de-dupe | campaign+platform+rule+date | Runtime only |
| Client health | `scoreClientHealth()` | Workspace cards |
| Lake insights | `materialize-datalake-insights.mjs` | `/api/admin/insights/*` |
| Cost coloring | Yesterday vs 7d avg (&gt;25% red, &gt;10% yellow) | Cost page |
| ETL freshness | `last_etl_at` per bronze key | Datalake page |
| ROI | LinkedIn spend + gold revenue / leads | Unified page |

---

## 4. Manual vs missing (filter)

**Keep manual (agency-sized):**

- Gold refresh via ETL cron; “Re-read” is a cache bump, not a substitute for ETL
- Lake Explore ad-hoc SQL (catalog expansion is enough; no saved-query product)
- GSC SA + LinkedIn CAPI as operator secrets / `campaigns.ts` (not an admin form)
- Anomaly thresholds in `src/data/campaigns.ts` (no alerting-config UI)
- Slack-only notification channels (Discord/email types exist; do not build them)
- Frozen AWS cost dashboard (do not revive Cost Explorer)

**Real gaps (todos in the backlog):**

1. Attribution is on the datalake page but not on contact 360 (already a CRM todo)
2. Funnel summary API has no UI; A/B **flags** page ≠ funnel `ab_variant` results
3. Stripe `dailyTrend` and unified KPIs have no time-series charts
4. Anomalies never appear in admin (Slack only)
5. `/admin/reports` nav removed; KPI and Cost are in Overview
6. SEO archive / workspace calendar still labeled or backed by Notion leftovers
7. Explore catalog incomplete; GSC dimension tabs empty (lake hygiene todos)
8. CSV export on gold tables; extra report sections — only after Reports exists
9. Other ad platforms in gold — already a Wait item; keep live `roi.ts` off admin

**Out of scope**

- Drag-and-drop dashboard customization / period-over-period widget builder
- Cohort / retention product analytics
- Real-time event firehose UI
- Discord / email notification products
- Unfreezing AWS Cost Explorer
- Per-workspace ad spend + SEO (join later, not a new warehouse)
