# Complete Cloudflare Free Tier Migration Guide
>
> Migrate from AWS Serverless ($40-80/month) to Cloudflare Free Tier ($0-10/month)

## Executive Summary

This guide provides a complete migration path for cloudless.gr to Cloudflare's free tier, reducing infrastructure costs to $0-10/month while maintaining all functionality.

**Cost Reduction:** ~$40-80/month (AWS) → $0-10/month (Cloudflare)
**Services Covered:** SSM, Lambda, S3, Athena, Cognito, Chatbot, Email, Cron

---

## Architecture Mapping

| AWS Component | Cloudflare Free Alternative | Migration Status |
|---------------|---------------------------|----------------|
| AWS SSM Parameter Store | Wrangler Secrets + Environment Variables | ✅ Ready |
| AWS Lambda | Cloudflare Workers | ✅ Ready |
| AWS S3 | Cloudflare R2 Object Storage | ✅ Ready |
| AWS Athena | DuckDB-Wasm over R2 | ✅ Ready |
| AWS Cognito | D1 Database + Custom Auth | ✅ Ready |
| AWS SES | SendGrid/Mailgun Free Tier | ✅ Ready |
| AWS Bedrock | Workers AI + Gemini | ✅ Ready |

---

## Step 1: Infrastructure Setup (CLI Commands)

```bash
# Enable R2 and D1 in Cloudflare Dashboard first
# https://dash.cloudflare.com → R2 → Enable
# https://dash.cloudflare.com → D1 → Enable

# Create R2 buckets
npx wrangler r2 bucket create app-media-bucket
npx wrangler r2 bucket create datalake-bucket

# Create D1 database
npx wrangler d1 create user-auth-db

# Add secrets (run individually for each secret)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put PROD_DATABASE_PASSWORD
```

---

## Step 2: Database Schema (schema.sql)

```sql
-- User table (replaces Cognito User Pool)
CREATE TABLE user (
    id TEXT NOT NULL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    company TEXT,
    phone TEXT,
    preferences_json TEXT
);

-- Session table (replaces SessionTokenStore)
CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Create indexes
CREATE INDEX idx_user_username ON user(username);
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_session_expires ON session(expires_at);
```

Apply: `npx wrangler d1 execute user-auth-db --file=./schema.sql`

---

## Step 3: Wrangler Configuration (wrangler-cloudflare-free.json)

```json
{
  "name": "fully-migrated-serverless-stack",
  "main": "src/index.js",
  "compatibility_date": "2026-07-09",
  "vars": { "ENVIRONMENT": "production", "API_VERSION": "v1.0" },
  "r2_buckets": [
    { "binding": "MEDIA_BUCKET", "bucket_name": "app-media-bucket" },
    { "binding": "DATALAKE_BUCKET", "bucket_name": "datalake-bucket" }
  ],
  "d1_databases": [
    { "binding": "AUTH_DB", "database_name": "user-auth-db", "database_id": "YOUR_D1_ID" }
  ]
}
```

---

## Step 4: Edge Runtime Controller (src/index-cloudflare-free.js)

Implements 3-layer architecture:

- **Layer 1:** `/api/login` - D1-based authentication
- **Layer 2:** `/api/upload` - R2 file storage
- **Layer 3:** `/api/analytics` - R2 parquet streaming for DuckDB-Wasm

---

## Step 5: Free Services Configuration

### Chatbot (Workers AI + Gemini)

| Provider | Free Tier | Command |
|----------|-----------|---------|
| Workers AI | 100K tokens/day | Built into Worker |
| Gemini | 1500 requests/day | `npx wrangler secret put GEMINI_API_KEY` |

### Email (SendGrid or Mailgun)

| Provider | Free Tier | Monthly Volume |
|----------|-----------|----------------|
| SendGrid | 100 emails/day | ~3,000/month |
| Mailgun | 5,000 emails/month | ~5,000/month |
| Brevo | 300 emails/day | ~9,000/month |

### Cron Jobs (GitHub Actions)

```yaml
# .github/workflows/cron.yml
on:
  schedule:
    - cron: '0 1 * * *'  # Daily at 01:00 UTC
```

Free: 2,000 minutes/month on GitHub Actions

---

## Migration Timeline

### Week 1: Infrastructure

- [ ] Enable R2/D1 in Cloudflare
- [ ] Create buckets and database
- [ ] Run schema migration
- [ ] Add secrets to Wrangler

### Week 2: Authentication

- [ ] Update `src/lib/auth.ts` to use D1
- [ ] Create registration endpoints
- [ ] Migrate Cognito users with password reset

### Week 3: Data Layer

- [ ] Replace DynamoDB calls with D1 queries
- [ ] Migrate user profiles and transactions
- [ ] Update analytics to DuckDB-Wasm

### Week 4: Services

- [ ] Replace SES with SendGrid/Mailgun
- [ ] Replace Bedrock with Workers AI/Gemini
- [ ] Set up GitHub Actions for cron

### Week 5: Testing & Cutover

- [ ] Test in staging
- [ ] Verify under 100K/day Workers limit
- [ ] Update DNS to Workers endpoint

---

## Free Tier Limits Monitoring

| Resource | Limit | Alert if |
|----------|-------|----------|
| Workers Requests | 100K/day | >80K/day |
| R2 Storage | 10GB/month | >8GB/month |
| D1 Storage | 500MB | >400MB |
| Workers AI | 100K tokens/day | >80K tokens |

Monitor via: `npx wrangler analytics`

---

## Rollback Plan

If issues arise within 30 days:

1. DNS revert to CloudFront (instant)
2. SES reactivated via console
3. Cognito users retained (dual-write during migration)
4. Data restored from DynamoDB backup

---

## Files Created

```
schema.sql
wrangler-cloudflare-free.json
src/index-cloudflare-free.js
src/lib/analytics-duckdb.ts
src/app/api/chat-ai/route.ts
scripts/sync-ssm-to-wrangler.ts
scripts/migrate-dynamodb-to-d1.ts
.github/workflows/deploy-cloudflare-free-tier.yml
