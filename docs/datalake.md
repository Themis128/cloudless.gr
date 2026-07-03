# Datalake — cloudless.gr

S3 + Glue + Athena. Single source of truth for product events, Stripe
transactions, and admin notifications archived past their hot
(DynamoDB) window.

## Topology

```
Lambda (Next.js)
   │  s3:PutObject
   ▼
s3://cloudless-analytics-data
   ├── events/year=YYYY/month=MM/day=DD/*.ndjson   (NDJSON product events)
   ├── lake/clients/                                (ETL — clients-to-lake.mjs)
   ├── lake/notifications/                          (admin-notifications.ts)
   ├── lake/portals/                                (ETL — portals-to-lake.mjs)
   ├── lake/transactions/                           (stripe-transactions.ts + ETL)
   ├── ml-models/, ml-parquet/                      (ML pipeline outputs)
   └── athena-results/                              (query results, auto-expired)
                       │
                       │  Glue Catalog: cloudless_analytics
                       ▼
              Athena workgroup primary  → operator queries
                       │
                       ├─ SQL → CLI / IDE (DBeaver, DataGrip)
                       ├─ Grafana → dashboards/lakehouse.json
                       ├─ MCP Server → tools/mcp-athena-server/
                       └─ Admin API → /api/admin/analytics/datalake
```

| Component | Detail |
|---|---|
| Bucket | `cloudless-analytics-data` (us-east-1) |
| Glue database | `cloudless_analytics` |
| Glue tables | `events`, `clients`, `notifications`, `portals`, `transactions` + 6 `v_*` views |
| Athena workgroup | `primary` (engine version 3) |
| Query result location | `s3://cloudless-analytics-data/athena-results/` (enforced by workgroup) |

## Wiring (Lambda → S3)

The Next.js Lambda writes NDJSON events directly to S3 via three libs:

| Library | What it writes | Prefix |
|---|---|---|
| `src/lib/analytics.ts` | Product events (signup, purchase, page_view, …) | `events/year=…/month=…/day=…/*.ndjson` |
| `src/lib/admin-notifications.ts` | Admin notification audit log | `lake/notifications/*` |
| `src/lib/stripe-transactions.ts` | Stripe transaction archive | `lake/transactions/*` |

All three default the bucket to `cloudless-analytics-data` and read
the override from `ANALYTICS_S3_BUCKET` env. The matching IAM grant
lives in `sst.config.ts`:

```typescript
{
  actions: ["s3:PutObject"],
  resources: [
    "arn:aws:s3:::cloudless-analytics-data/events/*",
    "arn:aws:s3:::cloudless-analytics-data/lake/*",
  ],
}
```

**Tight scope** — `s3:PutObject` only on the two write prefixes. No List, no
Delete, no Get. Athena and the ETL scripts use different principals.

### How this broke (and was fixed)

Before the 2026-06-20 datalake audit:

- The libs all defaulted to `cloudless-analytics-data` but `ANALYTICS_S3_BUCKET`
  was not set in the Lambda environment.
- The Lambda had **no `s3:*` permission at all** for this bucket.
- Every `PutObject` returned `AccessDenied`, caught by the `.catch()` blocks
  in the libs, logged to `console.error`, and silently dropped.
- Audit confirmed: `s3://cloudless-analytics-data/events/` had **0 objects**.

Fixed in PR #1013: added `ANALYTICS_S3_BUCKET` env + the matching scoped
`s3:PutObject` permission. After deploy, `aws s3 ls s3://cloudless-analytics-data/events/`
should show files growing with each request.

## ETL scripts (out-of-Lambda)

| Script | Source | Sink |
|---|---|---|
| `scripts/etl/stripe-to-lake.mjs` | Stripe API | `lake/transactions/` |
| `scripts/etl/portals-to-lake.mjs` | Notion / portal DB | `lake/portals/` |
| `scripts/etl/clients-to-lake.mjs` | EspoCRM / Notion | `lake/clients/` |

These run from a local laptop or CI, **not** from Lambda. They use
long-lived credentials with broader S3 access (Get/Put/Delete). Not
covered by the SST permission above.

## Security posture (audited 2026-06-20)

| Layer | Setting |
|---|---|
| S3 BPA | ALL ON (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`) |
| S3 bucket policy | None (no public exposure) |
| S3 ACL | Owner-only `FULL_CONTROL` |
| S3 SSE | AES256 (SSE-S3, blocks SSE-C) |
| S3 versioning | ✅ Enabled (turned on in this audit pass) |
| S3 lifecycle | ✅ `athena-results/` expire after 30 days; non-current versions after 90 days |
| Athena workgroup | ✅ `EnforceWorkGroupConfiguration=true`, `BytesScannedCutoffPerQuery=10 GB`, result encryption SSE-S3, output location pinned, CloudWatch metrics on |
| Glue catalog | Default account-owned encryption (KMS at-rest in Glue) |

## DynamoDB hot tier (paired with the lake)

Hot data lives in DynamoDB tables linked to the Lambda; archived data
goes to the lake. Audited 2026-06-20:

| Setting | Status |
|---|---|
| Server-side encryption | AWS-owned key (free, sufficient for non-PCI data) |
| Point-in-Time Recovery | ✅ Enabled on all 12 tables (35-day rollback) |
| Deletion protection | ✅ Enabled on all 6 production tables (set in audit) |
| DynamoDB Streams | Off everywhere |

| Prod table | Hot data |
|---|---|
| `cloudless-production-StripeTransactions…` | Recent Stripe events |
| `cloudless-production-UserProfile…` | User profiles |
| `cloudless-production-AdminNotifications…` | Recent ops alerts |
| `cloudless-production-AnalyticsCache…` | Cached aggregations |
| `cloudless-production-SessionTokenStore…` | next-auth session tokens |
| `cloudless-production-CloudlessSiteRevalidation…` | ISR revalidation tokens |

## Operations

### Verify wiring is live after deploy

```bash
# Trigger an event (visit any page on the live site), then:
aws s3 ls s3://cloudless-analytics-data/events/ --recursive | tail
# Should show a fresh NDJSON file under year=YYYY/month=MM/day=DD/
```

### Query the lake via CLI

```bash
aws athena start-query-execution \
  --work-group primary \
  --query-string "SELECT * FROM cloudless_analytics.v_revenue_monthly LIMIT 10"
```

Output lands in `s3://cloudless-analytics-data/athena-results/` and is
auto-expired after 30 days by the lifecycle rule.

### Query via Grafana Dashboard

1. Add Athena as a data source in Grafana with the `cloudless_analytics` database
2. Import `infrastructure/grafana/dashboards/lakehouse.json`
3. Dashboard shows: acquisition funnel, attribution, EspoCRM funnel, GSC keywords, LinkedIn ads, Sentry errors, self-hosted health, n8n workflow success

### Query via MCP Server

Start the MCP server:

```bash
cd tools/mcp-athena-server
pnpm start
```

Available tools:
- `athena_query` — natural language to SQL (basic keyword matching)
- `athena_execute_sql` — raw SQL execution
- `athena_list_databases` — list databases
- `athena_list_tables` — list tables in a database
- `athena_get_schema` — describe a table
- `athena_query_history` — recent queries

### Query via Admin API

```http
GET /api/admin/analytics/datalake?refresh=1
Authorization: Bearer <admin-jwt>
```

Returns 10 pre-built dashboard sections in one JSON payload.

## CloudWatch Alarms

The `lakehouse-athena-alerts.yml` workflow deploys 4 alarms:

| Alarm | Trigger |
|-------|---------|
| `Lakehouse-Athena-DataScanned-High` | Single query > 1GB |
| `Lakehouse-Athena-Queries-Failed` | 3+ failures in 3 periods |
| `Lakehouse-Athena-Queries-Slow` | Query > 25s |
| `Lakehouse-Athena-Workgroup-DailyUsage` | Daily > 5GB |

Deploy: `gh workflow run lakehouse-athena-alerts.yml`

### Restore a DynamoDB table to a point in time

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name cloudless-production-StripeTransactionsTable-nhtvnuew \
  --target-table-name stripe-restore-test \
  --restore-date-time 2026-06-20T08:00:00Z
```

### Disable deletion protection (only when intentionally removing a table)

```bash
aws dynamodb update-table \
  --table-name <table> \
  --no-deletion-protection-enabled
```

## What's not done yet

- **DynamoDB Streams** on `StripeTransactionsTable` → could feed a 2nd-tier
  audit trail (insert-only S3 archive). Defer until a regulatory driver requires it.
- **Customer-managed KMS** on `StripeTransactionsTable` + `UserProfileTable` →
  adds $2/mo per key and enables per-request decrypt audit via CloudTrail. Defer
  unless required for compliance (PCI/GDPR-with-audit, etc.). AWS-owned keys
  cover encryption-at-rest already.
- **S3 Object Lock** on the analytics bucket → would make objects immutable
  for retention. Useful for legal hold; overkill for product analytics.
- **AWS Backup vault** for DynamoDB → PITR + on-demand backups cover this
  today. Add only if cross-region DR becomes a requirement.
