# Datalake — cloudless.gr (Cloudflare)

R2 + D1 replace the former S3 + Glue + Athena stack. Admin analytics never
query Athena.

## Topology

```
Source APIs / cluster pods
   │  GitHub Actions ETL (scripts/etl/*-to-r2.mjs) on Pi runners
   ▼
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
   └── lake/snapshots/
         ├── admin-datalake.json   materialize-datalake-snapshots
         ├── gsc-weekly.json
         └── freshness.json
                       │
                       ▼
              Admin UI (/admin/analytics/datalake)
              ← also D1 analytics_events (acquisition + attribution)
```

| Component | Detail |
|---|---|
| Object store | Cloudflare R2 `datalake-bucket` |
| Hot events / cost rows | D1 `user-auth-db` (`analytics_events`, `aws_cost_daily`) |
| Schedulers | `.github/workflows/etl-*-to-r2.yml` on `[self-hosted, omv, build]` |
| Dashboard API | `src/lib/datalake-r2.ts` → `/api/admin/analytics/datalake` |

## Wiring (app → lake)

| Library | What it writes / reads | Store |
|---|---|---|
| `src/lib/analytics.ts` | Product events | D1 `analytics_events` (and optional R2 NDJSON) |
| `src/lib/datalake-r2.ts` | Admin dashboard sections | R2 snapshot + D1 |
| `src/lib/cost-analytics.ts` | Frozen AWS cost panels | D1 / R2 `lake/aws-cost/` |

## ETL scripts

Live scripts are `scripts/etl/*-to-r2.mjs` plus `materialize-datalake-snapshots.mjs`.
Deprecated `*-to-lake.mjs` Athena/S3 feeders are removed.

## Historical (Athena)

Athena SQL under `docs/data/analytics-athena.sql`, `docs/data/datalake-views.sql`,
and `infrastructure/athena/` is **historical only**. Do not create new Glue
tables or Athena views for this product path.
