# AWS to Fly.io/Cloudflare Migration Plan

## Current State
- **Primary Backend:** `d3k7muo3c6lw6s.cloudfront.net` (AWS CloudFront) - UPDATED
- **Fallback Backend:** `omv.tail8eb71.ts.net` (Pi via Tailscale)
- **Target Primary:** `cloudless.gr` (Cloudflare Workers - already deployed)

## Migration Phases

### Phase 1: Proxy Configuration Update ✅ DONE
- [x] Update `fly.toml` PRIMARY_HOST to `cloudless.gr`
- [x] Update `fly-proxy-app/proxy.py` PRIMARY_HOST to `cloudless.gr`
- [ ] Redeploy Fly.io proxy (requires `flyctl` installed)

### Phase 2: Secrets Migration ⚠️ PARTIAL
- [x] `scripts/sync-ssm-to-wrangler.ts` - Updated with all secrets mapping
- [x] 15 secrets synced to Wrangler

**Missing secrets (need to add to SSM or set directly):**
- SESSION_SECRET
- ANTHROPIC_CHAT_MODEL (optional)
- SLACK_WEBHOOK_URL
- SLACK_OPS_USERS
- GITHUB_DISPATCH_TOKEN
- AGENT_AUTH_TOKEN

### Phase 3: Data Migration ❌ IAM PERMISSION DENIED
- [x] `scripts/migrate-dynamodb-to-d1.ts` - Ready (table names updated)
- [x] `schema.sql` - D1 tables already defined
- [ ] Import data to D1 - **Failed**: `cloudless-ops` user lacks `dynamodb:Scan` permission

### Phase 4: Service Migration
- [x] SES → Cloudflare Email (email-sender.ts has fallback)
- [ ] S3 → R2 bucket sync (`scripts/migrate-s3-to-r2.js`)
- [ ] Athena → DuckDB-Wasm (analytics-client.ts - client-side ready)
- [ ] Bedrock → Workers AI
- [ ] SNS → Webhook notifications

### Phase 5: Auth Migration
- [x] D1 Auth endpoints ready in `src/index-cloudflare-free.js`
- [ ] Switch Cognito to D1 Auth (update auth routes)

### Phase 6: Cron Migration
- [x] `fly-cron-apps/cron-runner.ts` - Cron runner script created
- [ ] Create Fly.io scheduled machines for 4 Lambda jobs

## AWS Services Inventory

| Service | Migration Priority | Status | Action |
|---------|-------------------|--------|--------|
| SSM | HIGH | Ready | Secrets sync script created |
| Cognito | HIGH | Ready | D1 Auth implemented |
| DynamoDB | HIGH | Blocked | Add IAM permission |
| SES | MEDIUM | Ready | Email binding in wrangler.json |
| S3 | MEDIUM | Ready | migrate-s3-to-r2.js script exists |
| Athena | LOW | Ready | DuckDB-Wasm alternative exists |
| Bedrock | MEDIUM | Pending | Workers AI bindings needed |
| SNS | LOW | Pending | Webhook replacement needed |

## Execution Commands

```bash
# Fix IAM permissions (needed for DynamoDB migration)
pnpm tsx scripts/ses-smtp-iam-bootstrap.sh

# Migrate secrets
AWS_PROFILE=default pnpm tsx scripts/sync-ssm-to-wrangler.ts

# Migrate DynamoDB data
AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts

# Migrate S3 assets
AWS_PROFILE=default pnpm tsx scripts/migrate-s3-to-r2.js