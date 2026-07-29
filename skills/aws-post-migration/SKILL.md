---
name: aws-post-migration
description: |
  Clean up and verify resources after AWS to Cloudflare migration. Use when migration
  is complete and you need to verify the cutover, delete AWS resources, audit costs,
  or confirm all traffic has moved to Cloudflare. Triggered by phrases like "post-migration
  cleanup", "delete AWS resources", "AWS cleanup after migration", "verify Cloudflare cutover",
  "AWS cost after migration", "decommission DynamoDB", "remove S3 buckets", or
  "CloudFront still running".
---

# AWS Post-Migration Cleanup & Verification

After completing the AWS to Cloudflare migration, use this skill to verify the cutover
and safely clean up AWS resources to avoid unnecessary costs.

## When to invoke this skill

- Migration status shows 100% complete but AWS resources are still running
- You want to verify all traffic has moved to Cloudflare Workers
- You need to audit and clean up DynamoDB tables after confirming D1 redundancy
- You want to check AWS costs after migration
- You need to delete S3 buckets after R2 migration

## Stage 1 — Verify Cloudflare is Primary

```bash
# Check Workers endpoint
curl -s https://cloudless.gr/api/health | jq '.dbConnected, .authProvider'

# Verify Cloudflare DNS
dig cloudless.gr +short  # Should point to Cloudflare IPs (104.x.x.x or 172.x.x.x)

# Check that CloudFront is disabled
aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='cloudless.gr'].Id]" --output text
```

Expected outcomes:

- Workers health returns `true` and `d1`
- DNS returns Cloudflare IPs (not AWS origins)
- No active CloudFront distributions for your domains

## Stage 2 — Verify Data Redundancy

Before deleting DynamoDB, confirm all data exists in D1:

```bash
# Check D1 user count
npx wrangler d1 query user-auth-db --remote "SELECT COUNT(*) as count FROM user" --format json | jq '.[0].count'

# Compare with DynamoDB (if you still have access)
aws dynamodb scan --table-name cloudless-production-UserProfileTable-bctubzrn --select COUNT | jq '.Count'
```

If counts match, proceed to cleanup. If not, investigate before deletion.

## Stage 3 — AWS Resource Inventory

List all AWS resources that may need cleanup:

```bash
# DynamoDB tables
aws dynamodb list-tables --query "TableNames[?contains(@, 'cloudless')]"

# S3 buckets
aws s3 ls | grep cloudless

# CloudFront distributions
aws cloudfront list-distributions --query "DistributionList.Items[].{Id:Id,Domain:S3Origin?.Domain}" --output table

# IAM policies for migration tools (used for DynamoDB/S3 access)
aws iam list-policies --scope Local --query "Policies[?contains(PolicyName, 'DynamoDB') || contains(PolicyName, 'R2') || contains(PolicyName, 'Migration')].{Name:PolicyName,Arn:Arn}" --output table

# SSM parameters (to be deleted after confirming Cloudflare secrets)
aws ssm describe-parameters --parameter-filters "Key=Name,Option=Contains,Values=cloudless" | jq '.Parameters[].Name'
```

## Stage 4 — Cost Audit Before Cleanup

Check current AWS costs to quantify savings:

```bash
# Last 30 days cost by service
aws ce get-cost-and-usage \
  --time-period Start=2026-06-01,End=2026-07-01 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query "ResultsByTime[0].Groups[?BlendedCost.Amount>0].{Service:Keys[0],Cost:BlendedCost.Amount}" \
  --output table
```

## Stage 5 — Safe Cleanup Sequence

### 5.1 — Disable (don't delete) first

For CloudFront distributions, disable first and wait for deployment:

```bash
# Disable distribution (already done during migration)
# Only delete after confirming no traffic for 24-48 hours
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID | jq '.ETag'
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --if-match $ETAG \
  --distribution-config '{"Enabled": false}'
```

### 5.2 — DynamoDB cleanup (after confirming D1 sync)

```bash
# Delete tables only after confirming no fallback needed
aws dynamodb delete-table --table-name cloudless-production-UserProfileTable-bctubzrn
aws dynamodb delete-table --table-name cloudless-production-SessionTokenStoreTable-mrbwcwzt
aws dynamodb delete-table --table-name cloudless-production-StripeTransactionsTable-nhtvnuew
aws dynamodb delete-table --table-name cloudless-production-AdminNotificationsTable-uuhacatu
aws dynamodb delete-table --table-name cloudless-production-AnalyticsCacheTable-fneaemkr
```

### 5.3 — S3 bucket cleanup (after R2 migration)

```bash
# Empty bucket first, then delete
aws s3 rm s3://bucket-name --recursive
aws s3 rb s3://bucket-name --force
```

### 5.4 — IAM cleanup

```bash
# Delete migration-specific policies
aws iam delete-policy --policy-arn arn:aws:iam::ACCOUNT:policy/DynamoDBMigrationAccess
aws iam delete-policy --policy-arn arn:aws:iam::ACCOUNT:policy/S3MigrationAccess
```

### 5.5 — SSM parameter cleanup

```bash
# Delete SSM parameters after confirming Wrangler secrets
aws ssm delete-parameters --names \
  /cloudless/production/DYNAMODB_TABLE_USER \
  /cloudless/production/DYNAMODB_TABLE_SESSION \
  /cloudless/production/S3_BUCKET_ASSETS
```

## Stage 6 — Validate Cutover Success

After cleanup, verify everything works:

```bash
# Test all migrated routes
curl -s https://cloudless.gr/api/auth/session
curl -s https://cloudless.gr/api/chat -X POST -d '{"message":"test"}'
curl -s https://cloudless.gr/api/analytics/query

# Check Cloudflare analytics to confirm traffic
# (via Cloudflare dashboard or API if you have token)

# Verify no errors in Workers logs
npx wrangler tail --since 1h 2>&1 | head -20
```

## Stage 7 — Update Documentation

Update the following after successful cleanup:

1. `MIGRATION-STATUS.md` — Mark cleanup as complete
2. `CLAUDE.md` — Update "Pending One-Time Setup" table
3. `docs/aws-cleanup-log.md` — Create audit trail of deleted resources

```markdown
# AWS Cleanup Log (create this file)

## 2026-07-16
- Deleted DynamoDB tables: UserProfile, Session, StripeTransactions, AdminNotifications, AnalyticsCache
- Disabled CloudFront distributions: ELGQBR8109MTM
- Migrated S3 buckets to R2: cloudless-assets, datalake-bucket
- Deleted IAM policies: DynamoDBMigrationAccess, S3MigrationAccess
```

## Safety Rules

- **Never delete resources without 24-hour verification** — keep DynamoDB as fallback until you're sure
- **Always check cost before deletion** — quantify the savings
- **Delete SSM parameters last** — they may be needed for debugging
- **Keep CloudTrail logs** — for audit purposes (don't delete the logs themselves)
