# Run Your Migration - Step by Step

## Prerequisites

```bash
# Add to your shell environment
export AWS_PROFILE=default
export CLOUDFLARE_API_TOKEN=xxxxx  # Get from Cloudflare dashboard: My Profile → API Tokens
```

## Run the Migration

### Option 1: Full automated migration

```bash
# This requires CLOUDFLARE_API_TOKEN
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN \
  AWS_PROFILE=$AWS_PROFILE \
  pnpm tsx scripts/migrate-dynamodb-to-d1.ts
```

### Option 2: Manual DynamoDB migration (if you want to verify data first)

```bash
# Check DynamoDB tables
aws dynamodb scan --table-name cloudless-production-UserProfileTable-bctubzrn --limit 5

# Count records in each table
aws dynamodb scan --table-name cloudless-production-UserProfileTable-bctubzrn --select COUNT
aws dynamodb scan --table-name cloudless-production-SessionTokenStoreTable-mrbwcwzt --select COUNT
aws dynamodb scan --table-name cloudless-production-StripeTransactionsTable-nhtvnuew --select COUNT
aws dynamodb scan --table-name cloudless-production-AdminNotificationsTable-uuhacatu --select COUNT
aws dynamodb scan --table-name cloudless-production-AnalyticsCacheTable-fneaemkr --select COUNT
```

## S3 to R2 Migration Using CloudShift

Since you're in the CloudShift repository, you can use it for S3 → R2 migration:

```bash
# 1. Install CloudShift (if not already)
docker pull cloudshiftdev/app:latest

# 2. Run migration with rclone (included in your project)
# Using the migration script
pnpm tsx scripts/migrate-s3-to-r2.mjs cloudless-assets
pnpm tsx scripts/migrate-s3-to-r2.mjs app-media-bucket
pnpm tsx scripts/migrate-s3-to-r2.mjs cloudless-analytics-data

# Or directly with rclone
rclone sync s3:cloudless-assets r2:cloudless-assets --transfers 10 --checkers 20
rclone sync s3:cloudless-analytics-data r2:datalake-bucket --transfers 10
```

## Quick Validation

After migration, verify:

```bash
# Check D1 data
npx wrangler d1 execute user-auth-db --remote \
  --command "SELECT COUNT(*) as user_count FROM user"

npx wrangler d1 execute user-auth-db --remote \
  "SELECT COUNT(*) FROM stripe_transaction"

npx wrangler d1 execute user-auth-db --remote \
  "SELECT COUNT(*) FROM admin_notification"

# Check R2 buckets
npx wrangler r2 bucket list

# Check secrets
npx wrangler secret list --env=production
```

## Common Issues

### "CLOUDFLARE_API_TOKEN environment variable is required"

- Set your API token: `export CLOUDFLARE_API_TOKEN=your_token_here`
- Get token from: Cloudflare Dashboard → My Profile → API Tokens → Create Token

### "AccessDenied" on DynamoDB scan

- Run: `bash scripts/add-dynamodb-migration-permissions.sh`
- This adds `dynamodb:Scan` permission to `cloudless-ops` user

### Build errors on Windows/WSL

- Ensure line endings are correct: `dos2unix *.sh`
- Check Node.js version: `node --version` (need >= 20)

## Lambda@Edge Migration

Since CloudFront is deleted, migrate any Lambda@Edge functions:

```typescript
// Add to src/index-cloudflare-free.js:

// A/B Testing middleware (edge function equivalent)
if (url.searchParams.get("exp")) {
  // Handle experiment variant
}

// Geo redirect middleware
if (request.cf?.country === "GR") {
  const newUrl = new URL(request.url);
  if (!newUrl.pathname.startsWith("/el")) {
    newUrl.pathname = `/el${newUrl.pathname}`;
    return Response.redirect(newUrl.toString(), 301);
  }
}
