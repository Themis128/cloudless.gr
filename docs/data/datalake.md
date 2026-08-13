# Datalake — cloudless.gr (Cloudflare lakehouse)

R2 + D1 replace the former S3 + Glue + Athena stack. Admin analytics never
query Athena or live vendor APIs on page load.

## Architecture (serving layer)

```
Sources (Stripe, GSC, Sentry, EspoCRM, Postiz, n8n, AppFlowy, …)
   │  GitHub Actions ETL  scripts/etl/*-to-r2.mjs   ← silver (parquet)
   ▼
R2 datalake-bucket
   ├── lake/**/*.parquet
   └── lake/snapshots/
         ├── admin-datalake.json   ← gold (materialize-datalake-snapshots)
         ├── gsc-weekly.json
         └── freshness.json
                       │
                       ▼
         /api/admin/analytics/datalake  (src/lib/datalake-r2.ts)
                       │  gold first + D1 hot overlay (acquisition/attribution)
                       ▼
         /admin/analytics/datalake
```

| Layer   | Role                          | Cloudless                                       |
| ------- | ----------------------------- | ----------------------------------------------- |
| Silver  | Curated parquet per source    | `scripts/etl/*-to-r2.mjs` → R2                  |
| Gold    | Dashboard-ready aggregates    | `materialize-datalake-snapshots.mjs` → JSON     |
| Hot     | Near-real-time product events | D1 `analytics_events` (funnel/attribution only) |
| Serving | Admin API                     | `getDatalakeDashboard()` — **no live upstream** |

Admin UI must render gold + hot only. Missing sections show ETL/materialize
errors — never call Stripe/GSC/Sentry/Espo/Postiz/n8n from the browser or
admin route handlers for these cards.

### Gold sections (materialize → admin)

`acquisition_funnel`, `attribution` (hot D1 overlay), `top_keywords`,
`linkedin_ads`, `top_errors`, `espocrm_funnel`, `stripe_revenue`, `n8n_ops`,
`postiz_ops`, `appflowy_activity`, `freshness`.

Payload includes `source: "gold" | "hot_only" | "empty"` and optional
`freshness` from the snapshot.

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
   └── lake/snapshots/             materialize (gold)
```

| Component              | Detail                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| Object store           | Cloudflare R2 `datalake-bucket`                                    |
| Hot events / cost rows | D1 `user-auth-db` (`analytics_events`, `aws_cost_daily`)           |
| Schedulers             | `.github/workflows/etl-*-to-r2.yml` on `[self-hosted, omv, build]` |
| Dashboard API          | `src/lib/datalake-r2.ts` → `/api/admin/analytics/datalake`         |

## Optional next (Cloudflare Data Platform)

For ad-hoc SQL over silver parquet without Athena:

- Enable [R2 Data Catalog](https://developers.cloudflare.com/r2-data-catalog/) on `datalake-bucket`
- Query with [R2 SQL](https://developers.cloudflare.com/r2-sql/)

Admin dashboards should stay on **gold snapshots** for latency and cost;
R2 SQL is for explore/operator queries, not every page load.

## Historical (Athena)

Athena SQL under `docs/data/analytics-athena.sql` and `infrastructure/athena/`
is **historical only**. Do not create new Glue tables for this path.
