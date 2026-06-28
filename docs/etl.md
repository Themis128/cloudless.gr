# ETLs — cloudless.gr

Three GitHub-Actions-scheduled ETLs feed the datalake. All are
read-only against source systems and produce a single overwrite per
day. Pairs with `docs/datalake.md` (target topology) and
`docs/AUDIT-2026-06-20.md` (audit cadence).

## Pipeline map

```
External systems              ETL workflow                       Sink (S3 Parquet/NDJSON)
─────────────────────────     ──────────────────────────────     ─────────────────────────────────
Stripe API                →   etl-stripe-to-lake.yml         →   lake/transactions/transactions.parquet
Cognito + SSM + ML scores →   etl-clients-to-lake.yml        →   lake/clients/clients.parquet
SSM (CLIENT_PORTALS_JSON) →   (same workflow, sibling step)  →   lake/portals/portals.parquet
Athena Glue catalog        ←  analytics-etl.yml (MSCK REPAIR) ← s3://…/events/year=…/month=…/day=…/*.ndjson
                                                              ↑
                              Lambda (src/lib/analytics.ts)   ──┘  (NDJSON, real-time per request)
```

## Workflows

| Workflow | Schedule (UTC) | Source | Sink | Idempotency |
|---|---|---|---|---|
| `analytics-etl.yml` | `0 2 * * *` (02:00) | Hive partitions on `events/` | Glue catalog | Yes — `MSCK REPAIR TABLE` |
| `etl-hubspot-to-lake.yml` | `15 3 * * *` (03:15) | EspoCRM v3 API (contacts + deals + tickets) | `lake/hubspot-{contacts,deals,tickets}/` | Full refresh — overwrites |
| `etl-stripe-to-lake.yml` | `30 3 * * *` (03:30) | Stripe API (sessions/invoices/subs) | `lake/transactions/transactions.parquet` | Full refresh — overwrites |
| `etl-compute-rfm-churn.yml` | `45 3 * * *` (03:45) | `lake/transactions/transactions.parquet` (Stripe ETL output) | `ml-parquet/scores_{rfm,churn}.parquet` | Full refresh — replaces external ML pipeline |
| `etl-clients-to-lake.yml` | `0 4 * * *` (04:00) | Cognito + SSM + ml-parquet | `lake/clients/clients.parquet` + `lake/portals/portals.parquet` | Full refresh — overwrites |

All five use OIDC (`AWS_DEPLOY_ROLE_ARN`) to assume the deploy role —
no static AWS keys. Every workflow posts to `SLACK_WEBHOOK_URL` on
failure (`if: failure() && env.SLACK_WEBHOOK_URL != ''`).

### Daily ordering (UTC)

```
02:00 analytics-etl          (registers new events partitions in Glue)
03:15 etl-hubspot-to-lake    (CRM snapshot)
03:30 etl-stripe-to-lake     (Stripe transactions snapshot)
03:45 etl-compute-rfm-churn  (reads Stripe parquet, computes scores)
04:00 etl-clients-to-lake    (joins Cognito + SSM + RFM scores)
```

The 15-min spacing isn't strict but it keeps clients-to-lake able to
read the RFM scores written 15 min earlier (instead of yesterday's).

## Source scripts

- `scripts/etl/stripe-to-lake.mjs` — pulls Stripe via SDK, normalises
  into a transactions schema (id, email, type=checkout/invoice/sub,
  status, amount_cents, currency, product, plan, timestamps), writes
  parquet via `@dsnp/parquetjs`.
- `scripts/etl/hubspot-to-lake.mjs` — pulls EspoCRM v3 (contacts,
  deals, tickets) with cursor pagination, writes 3 parquet files.
  Drives the v_espocrm_funnel and v_lead_to_customer Athena views.
- `scripts/etl/compute-rfm-churn.mjs` — reads
  `lake/transactions/transactions.parquet`, computes RFM (Recency,
  Frequency, Monetary) per email + simple recency-based churn risk,
  writes `ml-parquet/scores_rfm.parquet` and
  `ml-parquet/scores_churn.parquet`. Replaces the external ML pipeline
  whose output was 5+ days stale at the 2026-06-20 audit. Composite
  RFM score is weighted 30% R + 30% F + 40% M, mapped to a 0-100 scale.
  Churn bands: low / medium / high / at_risk by days-since-last-purchase.
- `scripts/etl/portals-to-lake.mjs` — reads `/cloudless/CLIENT_PORTALS_JSON`
  SSM, computes per-portal health score (blocked steps × 25 +
  changes_requested × 10 + open-payments-over-14-days × 20, floored at 0),
  writes parquet.
- `scripts/etl/clients-to-lake.mjs` — lists Cognito users, joins
  `/cloudless/PENDING_CLIENTS_JSON` (plan info) +
  `/cloudless/CLIENT_PORTALS_JSON` (portal token) + RFM/churn scores
  produced by `compute-rfm-churn.mjs` (above) — internally generated
  now instead of relying on an external pipeline.

## Output shape (Glue catalog)

| Glue table | S3 location | Format | Refresh |
|---|---|---|---|
| `events` | `s3://cloudless-analytics-data/events/` | NDJSON, Hive-partitioned (year/month/day) | Per-request (Lambda) |
| `transactions` | `s3://cloudless-analytics-data/lake/transactions/` | Parquet | Daily 03:30 UTC |
| `hubspot_contacts` | `s3://cloudless-analytics-data/lake/hubspot-contacts/` | Parquet | Daily 03:15 UTC |
| `hubspot_deals` | `s3://cloudless-analytics-data/lake/hubspot-deals/` | Parquet | Daily 03:15 UTC |
| `hubspot_tickets` | `s3://cloudless-analytics-data/lake/hubspot-tickets/` | Parquet | Daily 03:15 UTC |
| `clients` | `s3://cloudless-analytics-data/lake/clients/` | Parquet | Daily 04:00 UTC |
| `portals` | `s3://cloudless-analytics-data/lake/portals/` | Parquet | Daily 04:00 UTC |
| `notifications` | `s3://cloudless-analytics-data/lake/notifications/` | Parquet | Per-event (Lambda, via `admin-notifications.ts`) |

Plus Athena views — 6 pre-existing
(`v_client_health`, `v_daily_events`, `v_funnel`, `v_ltv_ranking`,
`v_project_velocity`, `v_revenue_monthly`) and 4 new from this audit
(`v_acquisition_funnel`, `v_attribution_by_source`, `v_espocrm_funnel`,
`v_lead_to_customer`) — defined in `docs/analytics-athena.sql`.

## Health snapshot (2026-06-20)

| Check | Result |
|---|---|
| `etl-stripe-to-lake` last 3 runs | ✅ SUCCESS / SUCCESS / SUCCESS |
| `etl-clients-to-lake` last 3 runs | ✅ SUCCESS / SUCCESS / SUCCESS |
| `analytics-etl` (partition repair) | ✅ SUCCESS (visible in last week's runs) |
| `lake/transactions/transactions.parquet` | 12.4 KiB · today |
| `lake/clients/clients.parquet` | 7.3 KiB · today |
| `lake/portals/portals.parquet` | 7.0 KiB · today |
| `events/` (Lambda writer) | **0 objects until PR #1013 ships** — see datalake doc |
| OIDC role | Working (3 daily successes) |

## Findings + fixes (this audit pass)

| Finding | Severity | Fix |
|---|---|---|
| `npm install` in workflows (drift risk; lockfile ignored) | Medium | ✅ Switched both ETL workflows to `npm ci` (uses `scripts/etl/package-lock.json`) |
| `stripe@18` hardcoded literal in workflow | Low | ✅ Now resolved from the lockfile (still 18.5.0 — defer major bump to Stripe 22 to a focused PR; API surface used is stable enough) |
| Silent `.catch(() => [])` in `loadSSMJson` / `loadScores` / `loadPortals` masked AccessDenied vs ParameterNotFound vs JSON-parse | Medium | ✅ Now `console.warn(err.name \|\| err.message)` so CloudWatch / Actions logs surface the real cause |
| `ml-parquet/*` files consumed by `clients-to-lake.mjs` but **not produced by any workflow in this repo** | Documented | External — produced by a separate ML pipeline (latest file 2026-06-15, 5 days old). Out of audit scope. |

## What's still deferred

- **Stripe 18 → 22 major** — the SDK ETL uses surface (`stripe.checkout.sessions.list`, `stripe.invoices.list`, `stripe.subscriptions.list`, `inv.status_transitions.paid_at`, `sub.current_period_start`) is stable across this jump, but the bump warrants its own PR with a workflow_dispatch dry-run before merge.
- **Incremental sync** — all three ETLs do a full daily refresh. At today's volume (10-15 KiB parquet files) the runtime is sub-second. Worth revisiting when transactions cross ~100k rows.
- **ML pipeline ownership** — `ml-parquet/*` files have no scheduled job in this repo. Track down the producer and document it (or migrate it in). Files are 5 days stale as of this audit.
- **Failure notifications** — ETL workflows emit Actions-tab red on failure but no Slack/email. Hook into the `#errors` channel via the existing `SlackClient`.

## Verify after the PR #1013 deploy lands

Once the SST deploy for PR #1013 (Lambda S3 grant) completes:

```bash
# Lambda should start writing NDJSON events to s3://…/events/
aws s3 ls s3://cloudless-analytics-data/events/ --recursive | head

# Trigger a page view on the live site, wait ~10s, then:
aws s3 ls s3://cloudless-analytics-data/events/ --recursive | tail
# Should show a fresh year=YYYY/month=MM/day=DD/<ts>-<rand>.ndjson file

# Then next day at 02:00 UTC analytics-etl will register the partition
# automatically via MSCK REPAIR.
```
