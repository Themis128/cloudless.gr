# Cloudflare Free Tier Migration Guide

> **Status**: Complete architectural document for migrating from AWS Serverless to Cloudflare's Forever-Free Tier

## Executive Summary

This guide documents the migration of cloudless.gr's AWS serverless components to Cloudflare's free tier. **Important**: Some breaking changes are unavoidable due to feature gaps between AWS and Cloudflare offerings.

## Component Mapping & Trade-offs

| AWS Component | Cloudflare Free Alternative | Breaking Changes | Migration Complexity |
|---------------|---------------------------|------------------|---------------------|
| **AWS SSM** | Wrangler Secrets + Environment Variables | No bulk parameter mapping; secrets must be migrated individually | Medium |
| **AWS Lambda** | Cloudflare Workers (V8 Edge Compute) | No Node.js 22 ARM64; must use `nodejs_compat` flag; 30s CPU limit | High |
| **AWS S3** | Cloudflare R2 Object Storage | Zero egress fees (benefit); no native Athena equivalent | Medium |
| **AWS Athena** | Client-Side DuckDB-Wasm over R2 | No server-side querying; queries run in browser | High |
| **AWS Cognito** | Zero Trust Access + D1 Database | No OIDC/OAuth flows; no hosted UI; no password reset; no MFA; admin group must be rebuilt | Very High |

---

## Phase 1: Infrastructure Setup (Wrangler CLI)

### Prerequisites

Enable R2 and D1 in Cloudflare Dashboard first:

- R2: https://dash.cloudflare.com → R2 → Enable
- D1: https://dash.cloudflare.com → D1 → Enable

### Step 1: Create R2 Buckets

```bash
# Media/asset storage (replaces S3 for static files)
npx wrangler r2 bucket put cloudless-assets

# Data lake storage (for analytics parquet files)
npx wrangler r2 bucket put cloudless-analytics

# User uploads (if needed)
npx wrangler r2 bucket put cloudless-uploads
```

### Step 2: Create D1 Database

```bash
# Create database for auth + user profiles
npx wrangler d1 create cloudless-auth
```

### Step 3: Migrate SSM Secrets to Wrangler

List current SSM parameters and migrate to secrets:

```bash
# Get list of SSM parameters
aws ssm describe-parameters --parameter-filters Key=Path,Option=Recursive,Values="/cloudless/production" \
  --query 'Parameters[*].Name' --output text

# Migrate secrets individually
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put AUTH_SECRET
npx wrangler secret put SLACK_WEBHOOK_URL
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_SIGNING_SECRET
# ... continue for all required secrets

# For non-secrets (API URLs, config), use wrangler.jsonc vars section
```

### Step 4: Update wrangler.jsonc

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cloudless-gr",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  
  // ─── Static Assets ───────────────────────────────────────────────
  "assets": { "binding": "ASSETS", "directory": "./out" },
  
  // ─── Environment Variables (non-secret) ──────────────────────────
  "vars": {
    "NEXT_PUBLIC_SITE_URL": "https://cloudless.gr",
    "AWS_REGION": "us-east-1", // Deprecated but kept for compatibility
    // Add non-sensitive config here
  },
  
  // ─── R2 Buckets ──────────────────────────────────────────────────
  "r2_buckets": [
    { "binding": "ASSETS_BUCKET", "bucket_name": "cloudless-assets" },
    { "binding": "ANALYTICS_BUCKET", "bucket_name": "cloudless-analytics" }
  ],
  
  // ─── D1 Database ─────────────────────────────────────────────────
  "d1_databases": [
    { "binding": "AUTH_DB", "database_name": "cloudless-auth", "database_id": "<from Step 2>" }
  ]
}
```

---

## Phase 2: Authentication Migration

### Current Cognito Schema Analysis

The existing Cognito User Pool stores:

- User profiles (email, name, company, phone, preferences)
- Group membership (admin users)
- Password hashes (bcrypt)
- Token refresh flow (handled by next-auth)

### D1 Authentication Schema

Create `migrations/0001-auth-schema.sql`:

```sql
-- Users table (replaces Cognito User Pool)
CREATE TABLE user (
  id TEXT NOT NULL PRIMARY KEY,  -- UUID or email hash
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,   -- bcrypt hash
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Admin group (replaces Cognito groups)
CREATE TABLE user_role (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Sessions (replaces SessionTokenStore + token offloading)
CREATE TABLE session (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_session_expires ON session(expires_at);

-- Seed admin user (after migration)
-- INSERT INTO user (id, email, password_hash) VALUES (?, ?, ?);
-- INSERT INTO user_role (user_id, role) VALUES (?, 'admin');
```

Apply migration:

```bash
npx wrangler d1 execute cloudless-auth --file=./migrations/0001-auth-schema.sql
```

### Auth Code Changes Required

1. **Replace `src/lib/auth.ts`** with custom JWT-based auth using Lucia or OAuth2-server
2. **Replace `src/lib/session-token-store.ts`** with D1 queries
3. **Update API routes** in `src/app/api/auth/` to use new auth provider
4. **Migrate Cognito users**: Export from Cognito, import to D1 with password reset flow

---

## Phase 3: Data Layer Migration

### DynamoDB → D1 Table Mapping

| DynamoDB Table | D1 Table | Notes |
|----------------|----------|-------|
| UserProfile | user | Same columns plus extended profile |
| SessionTokenStore | session | Simplified token storage |
| StripeTransactions | stripe_transaction | Transaction logs |
| AdminNotifications | admin_notification | Events log |
| AnalyticsCache | analytics_cache | Query result caching |

### Migration Script

Create `scripts/migrate-dynamodb-to-d1.ts`:

```typescript
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { execSync } from "child_process";

async function migrateTable(tableName: string) {
  const client = new DynamoDBClient({ region: "us-east-1" });
  const result = await client.send(new ScanCommand({ TableName: tableName }));
  
  // Convert DynamoDB items to SQL inserts
  for (const item of result.Items || []) {
    const row = Object.entries(item).map(([k, v]) => {
      if (v.S !== undefined) return `${k}='${v.S}'`;
      if (v.N !== undefined) return `${k}=${v.N}`;
      return null;
    }).filter(Boolean).join(", ");
    
    // Use wrangler to insert
    execSync(
      `echo "INSERT INTO ${tableName} (${Object.keys(item).join(", ")}) VALUES (${row});" | npx wrangler d1 execute cloudless-auth --command -`
    );
  }
}
```

---

## Phase 4: Analytics Data Lake Migration

### Current Athena Query Pattern

The existing `src/lib/athena.ts` runs server-side queries:

- Weekly rollup aggregation
- GSC keyword analysis
- Transaction insights

### DuckDB-Wasm Client-Side Implementation

Create `src/lib/analytics-client.ts`:

```typescript
// Client-side DuckDB queries over R2 parquet files
import * as duckdb from '@duckdb/duckdb-wasm';

export async function queryAnalytics(
  sql: string,
  parquetPath?: string
): Promise<any[]> {
  const db = await duckdb.createInstance(
    new Worker(new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url))
  );
  
  if (parquetPath) {
    await db.query(`CREATE VIEW analytics AS SELECT * FROM read_parquet('${parquetPath}')`);
  }
  
  return db.query(sql).toArray();
}
```

### R2 Parquet File Adapter

Create `src/app/api/analytics/r2/route.ts`:

```typescript
export async function GET(request: Request, env: Env) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  
  if (!file) {
    return new Response("Missing file parameter", { status: 400 });
  }
  
  // Stream parquet file from R2 for DuckDB-Wasm
  const object = await env.ANALYTICS_BUCKET.get(`lake/${file}`);
  
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  
  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Accept-Ranges", "bytes");
  
  return new Response(object.body, { headers });
}
```

---

## Phase 5: Cron Jobs Alternative

Workers Cron Triggers are NOT free. Alternatives:

### Option A: GitHub Actions (Free 2,000/month)

```yaml
# .github/workflows/cron-free-tier.yml
on:
  schedule:
    - cron('0 1 * * *')  # Daily 01:00 UTC
    - cron('0 6 * * 1-5')  # Weekdays 06:00 UTC

jobs:
  analytics-rollup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/query-and-store
```

### Option B: Upstash QStash (Free tier)

```typescript
// Use QStash for scheduled triggers to Worker endpoints
import { Client } from "@upstash/qstash";

const client = new Client({ token: process.env.QSTASH_TOKEN });
await client.createSchedule({
  destination: "https://cloudless.gr/api/cron/analytics-rollup",
  cron: "0 1 * * *",
});
```

---

## Phase 6: Deployment Pipeline

### Current AWS Pipeline vs Cloudflare Migration

| Current | Migration Target | Command |
|---------|------------------|---------|
| `sst deploy` | `wrangler deploy` | Deploy Workers |
| Lambda warmers | Pages warmup or Cron trigger | Keep warm |
| CloudFront cert | Custom domain on Cloudflare | DNS setting |
| CloudWatch logs | Workers Logs | Built-in observability |

### GitHub Actions for Cloudflare

Create `.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: wrangler/action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy
```

---

## Strict Free Tier Guardrails

| Resource | Free Tier Limit | Current Usage | Status |
|----------|-----------------|---------------|--------|
| Workers Requests | 100K/day | Unknown | Monitor via analytics |
| R2 Storage | 10 GB/month | ~1 GB analytics | ✅ Under limit |
| R2 Operations | 1M/month | ~10K/month | ✅ Under limit |
| D1 Storage | 500 MB | ~50 MB expected | ✅ Under limit |
| D1 Operations | 5M/month | ~50K/month expected | ✅ Under limit |

---

## Migration Steps Checklist

- [ ] Enable R2 and D1 in Cloudflare Dashboard
- [ ] Create R2 buckets (`cloudless-assets`, `cloudless-analytics`)
- [ ] Create D1 database (`cloudless-auth`)
- [ ] Run schema migrations
- [ ] Migrate SSM secrets to Wrangler
- [ ] Update wrangler.jsonc with new bindings
- [ ] Replace auth library with custom implementation
- [ ] Migrate user profiles from DynamoDB to D1
- [ ] Create client-side analytics query layer
- [ ] Set up alternative cron triggers
- [ ] Update build pipeline for Workers
- [ ] Test full migration in staging
- [ ] Cutover DNS to Workers

---

## Breaking Changes Acknowledged

1. **No OAuth callbacks** - Users must sign in via email/password only
2. **No password reset** - Must implement custom flow or rely on email reset
3. **No MFA/SSO** - Will be lost in migration
4. **No server-side Athena** - Analytics moves to browser ( DuckDB-Wasm)
5. **No Lambda cron** - Requires alternative scheduler
6. **No CloudWatch** - Workers observability is different

---

## Rollback Plan

If migration fails:

1. Keep AWS deployment running as backup
2. DNS CNAME points to CloudFront (easy revert)
3. Database snapshots in both systems during transition
4. 7-day rollback window documented in SSM `/cloudless/migration-backup-timestamp`
