---
name: aws-migration-preflight
description: |
  Pre-flight checklist for AWS to Cloudflare migration. Use before starting any
  migration to validate prerequisites, verify credentials, check resource budgets,
  and ensure rollback capability exists. Triggered by phrases like "prepare migration",
  "migration checklist", "before AWS migration", "migration pre-flight", "migration
  prerequisites", or "migration readiness check".
---

# AWS to Cloudflare Migration Pre-Flight Checklist

Before migrating any service from AWS to Cloudflare, run this checklist to ensure
all prerequisites are met and rollback paths are available.

## When to invoke this skill

- Planning to start AWS to Cloudflare migration
- Want to verify all credentials and secrets are in place
- Need to check resource budgets (RAM, CPU, storage) on target infrastructure
- Want to establish a rollback plan before migration

## Stage 1 — Verify Cloudflare Credentials

```bash
# Check Cloudflare API token validity
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify | jq '.success, .result.status'

# Verify account access
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID" | jq '.success'

# Check Workers binding
npx wrangler whoami
```

Required permissions:

- Account: Workers Scripts (Read/Edit)
- Account: R2 Storage (Read/Edit)
- Account: D1 Database (Read/Edit)
- Zone: DNS (Edit)
- Zone: Load Balancing (Edit)

## Stage 2 — Verify Wrangler Secrets

```bash
# List current secrets
npx wrangler secret list --config wrangler-cloudflare-free.json

# Expected secrets for full migration:
# AUTH_SECRET, SESSION_SECRET
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# SES_FROM_EMAIL, SES_TO_EMAIL, AWS_SES_REGION
# GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL
# NOTION_API_KEY, APPFLOWY_API_URL, APPFLOWY_JWT_SECRET
```

If any secrets are missing, run:

```bash
# Sync from SSM (if available)
AWS_PROFILE=default pnpm tsx scripts/sync-ssm-to-wrangler.ts

# Or set manually
npx wrangler secret put --config wrangler-cloudflare-free.json SECRET_NAME
```

## Stage 3 — Check Resource Budgets

### Pi Cluster (omv - 8GB RAM)

```bash
# Current RAM usage
kubectl top nodes

# Expected output: ~2.4Gi used (29%) on omv
# Available: ~5.6Gi for new services
```

Required resources for full stack:

| Service | RAM Required | Storage | Can Fit? |
|---------|-------------|---------|----------|
| AppFlowy (9 pods) | ~700Mi | 30Gi | ✅ Yes |
| n8n | ~1Gi | 5Gi | ✅ Yes |
| EspoCRM | ~512Mi-1Gi | 10Gi | ✅ Yes |
| Postiz | ~512Mi-1Gi | 20Gi | Conditional (need headroom) |

### Cloudflare Workers Free Tier Limits

- Requests: 100,000/day
- Duration: 30ms CPU time per request
- D1: 5M rows read/day, 100K rows written/day
- R2: 10GB storage, 10GB egress/day

## Stage 4 — Verify Migration Scripts

Ensure all migration scripts exist and are executable:

```bash
# Check migration scripts
ls -la scripts/migrate-*
ls -la scripts/disable-*

# Required scripts:
# migrate-dynamodb-to-d1.ts      ✓
# migrate-s3-to-r2.mjs           ✓
# disable-cloudfront.sh          ✓
# sync-ssm-to-wrangler.ts        ✓

# Check IAM permissions for DynamoDB migration
aws iam get-policy --policy-arn arn:aws:iam::ACCOUNT:policy/DynamoDBMigrationAccess
```

## Stage 5 — Verify HA Failover Configuration

```bash
# Check Fly.io proxy configuration
cat fly.toml | grep -A3 '\[env\]

# Expected:
# PRIMARY_HOST = "cloudless.gr"
# FALLBACK_HOST = "omv.tail8eb71.ts.net"

# Verify Pi cluster is healthy
kubectl get nodes
kubectl get pods -A
```

## Stage 6 — Backup Current State

Before making changes, create backups:

```bash
# Backup D1 schema
npx wrangler d1 export user-auth-db --output migrations/d1-backup-$(date +%Y%m%d).sql --remote

# Backup k8s manifests
kubectl get -o yaml -n appflowy all > backups/appflowy-$(date +%Y%m%d).yaml
kubectl get -o yaml -n database all > backups/database-$(date +%Y%m%d).yaml

# Backup current CloudFormation/Lambda config
aws cloudformation describe-stacks --stack-name cloudless-production > backups/cf-stack-$(date +%Y%m%d).json
```

## Stage 7 — Test Migration Path

Run a small test migration first:

```bash
# Test D1 connection
npx wrangler d1 execute user-auth-db --remote --command "SELECT 1 as test"

# Test R2 connection
npx wrangler r2 bucket list --remote

# Test a single endpoint migration
npx wrangler deploy --config wrangler-cloudflare-free.json --dry-run
```

## Stage 8 — Document Rollback Plan

Create rollback documentation:

```markdown
# Migration Rollback Plan

## Rollback Conditions
Rollback if ANY of these fail:
1. Health endpoint returns errors for >5 minutes
2. D1 sync fails during cutover
3. Cloudflare rate limit exceeded

## Rollback Steps
1. Re-enable CloudFront distribution: `aws cloudfront update-distribution ...`
2. Revert fly.toml PRIMARY_HOST to old Lambda endpoint
3. Restore DynamoDB from backup if needed
4. Restore S3 bucket contents if needed

## Emergency Contacts
- Primary: tbaltzakis@cloudless.gr
- Backup: (secondary contact)
```

## Safety Rules

- **Never migrate without verified rollback** — test the rollback path first
- **Always run a dry-run** — verify commands before execution
- **Keep old resources for 48 hours** — don't delete until sure
- **Monitor cost impact** — check AWS bill after migration
- **Update documentation immediately** — record what was changed
