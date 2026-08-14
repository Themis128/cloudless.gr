# Datalake — cloudless.gr (Cloudflare lakehouse)

R2 + D1 replace the former S3 + Glue + Athena stack. Admin analytics and AI
**read the lake only** — never Athena or live vendor APIs on page load.

Layer-by-layer map (ingestion, medallion, DuckDB / AE / D1, insights, APIs,
admin UI) is this hub. Filtered follow-ups live in
[`../roadmap/agency-platform-backlog.md`](../roadmap/agency-platform-backlog.md).
Operator UI map:
[`admin-analytics-ui-report.md`](admin-analytics-ui-report.md).

## Architecture (hub)

```
Sources (Stripe, GSC, Sentry, EspoCRM, Postiz, n8n, AppFlowy, …)
   │  GitHub Actions ETL  scripts/etl/*-to-r2.mjs   ← silver (parquet)
   ▼
R2 datalake-bucket
   ├── lake/**/*.parquet
   └── lake/snapshots/
         ├── admin-datalake.json      ← gold aggregates
         ├── gsc-weekly.json
         ├── freshness.json
         └── insights/
               ├── {domain}.json      ← gold LLM insights
               ├── insights-index.json
               └── orchestration.json
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
  materialize-datalake-snapshots   materialize-datalake-insights
  (parquet → gold JSON)            (gold packs → Workers AI / Gemini)
                       │
                       ▼
         src/lib/datalake-serve.ts   ← shared serving facade
                       │
         /api/admin/analytics/*  /api/admin/insights/*  /api/admin/ai/*
```

| Layer   | Role                          | Cloudless                                       |
| ------- | ----------------------------- | ----------------------------------------------- |
| Silver  | Curated parquet per source    | `scripts/etl/*-to-r2.mjs` → R2                  |
| Gold    | Dashboard-ready aggregates    | `materialize-datalake-snapshots.mjs` → JSON     |
| Insights| LLM narratives over gold      | `materialize-datalake-insights.mjs` → JSON      |
| Hot     | Near-real-time product events | D1 `analytics_events` (funnel/attribution only) |
| Serving | Admin APIs                    | `datalake-serve.ts` — **no live upstream**      |

Admin UI and AI tools render gold + insights (+ D1 hot overlay). Missing
sections show ETL/materialize errors — never call Stripe/GSC/Sentry/Espo/ads
from those handlers.

### Gold aggregate sections

`acquisition_funnel`, `attribution` (hot D1 overlay), `top_keywords`,
`linkedin_ads`, `top_errors`, `espocrm_funnel`, `stripe_revenue`, `n8n_ops`,
`postiz_ops`, `appflowy_activity`, `freshness`.

### Insight domains

`seo`, `revenue`, `crm_funnel`, `ads`, `ops_errors`, `executive`, `orchestration`.

Each insight object: `{ domain, generated_at, model, provider, inputs_ref,
summary, bullets[], metrics_cited[], confidence, freshness, error? }`.

APIs:

- `GET /api/admin/insights` — index
- `GET /api/admin/insights/[domain]` — single insight (200 with `error` if missing)
- `POST /api/admin/insights/refresh` — records refresh / optional webhook (no vendors)

Analytics orchestration (`POST /api/admin/ai/analytics-orchestration`) serves
`insights/orchestration.json` by default. Pass `live_llm=1` (query or body) to
regenerate with Workers AI/Gemini using **lake gold context only**, then cache
back to R2.

### E2E contract

Unauthenticated `GET /api/admin/analytics/datalake` and `/api/admin/insights`
→ **401/403**. With `NEXT_PUBLIC_E2E=1` + Bearer `E2E_ADMIN_TOKEN` → **200**
lake-shaped JSON. See `e2e/migrated/admin-api.spec.ts` and
`docs/runbooks/test-accounts.md`.

## Topology (storage)

```
R2 datalake-bucket
   ├── lake/transactions/          stripe-to-r2
   ├── lake/clients/               clients-to-r2
   ├── lake/portals/               portals-to-r2
   ├── lake/gsc-keywords/          gsc-to-r2
   ├── lake/sentry-issues/         sentry-to-r2
   ├── lake/linkedin-ads/          linkedin-ads-to-r2
   ├── lake/espocrm-*/             espocrm-to-r2
   ├── lake/appflowy-*/            appflowy-to-r2
   ├── lake/postiz-*/              postiz-to-r2
   ├── lake/n8n-*/                 n8n-to-r2
   ├── ml-parquet/                 compute-rfm-churn-to-r2
   └── lake/snapshots/             materialize (gold + insights)
```

| Component              | Detail                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Object store           | Cloudflare R2 `datalake-bucket`                                    |
| Hot events / cost rows | D1 `user-auth-db` (`analytics_events`, `aws_cost_daily`)           |
| Schedulers             | `.github/workflows/etl-*-to-r2.yml` on `[self-hosted, omv, build]` |
| Aggregates             | `etl-materialize-snapshots.yml` (:45 UTC)                          |
| Insights               | `etl-materialize-insights.yml` (:50 UTC / after aggregates)        |
| Dashboard API          | `src/lib/datalake-r2.ts` + `datalake-serve.ts`                     |

## Optional next (Cloudflare Data Platform)

Operator ad-hoc SQL over silver parquet **without Athena** is already covered by
**Lake Explore** (`/admin/analytics/explore` — DuckDB-Wasm + catalog-allowlisted
parquet). Dashboards stay on **gold snapshots**.

Cloudflare [R2 Data Catalog](https://developers.cloudflare.com/r2-data-catalog/) +
[R2 SQL](https://developers.cloudflare.com/r2-sql/) remain **optional** Iceberg
platform enablement on `datalake-bucket` when an operator wants CF-managed SQL
outside the app. Do not route page loads through R2 SQL.

## Historical (Athena)

Athena SQL under `docs/data/analytics-athena.sql` and `infrastructure/athena/`
is **historical only**. Do not create new Glue tables for this path.
