# Cloudflare Free Tier Migration Checklist

> **Status**: Ready for implementation - see MIGRATION-CLOUDFLARE-FREE.md for full guide

## Pre-Migration (Must complete before cutover)

- [ ] **Enable Cloudflare R2 and D1 in Dashboard**
  - Login to https://dash.cloudflare.com
  - Navigate to R2 → Enable
  - Navigate to D1 → Enable

- [ ] **Create R2 Buckets** (via Wrangler CLI)

  ```bash
  npx wrangler r2 bucket put cloudless-assets
  npx wrangler r2 bucket put cloudless-analytics
  npx wrangler r2 bucket put cloudless-uploads
  ```

- [ ] **Create D1 Database** (via Wrangler CLI)

  ```bash
  npx wrangler d1 create cloudless-auth
  ```

- [ ] **Apply D1 Schema Migration**

  ```bash
  npx wrangler d1 execute cloudless-auth --file=./migrations/0001-auth-schema.sql
  ```

- [ ] **Migrate SSM Secrets to Wrangler**

  ```bash
  # List current SSM params
  aws ssm describe-parameters --parameter-filters Key=Path,Option=Recursive,Values="/cloudless/production"
  
  # Run sync script (requires AWS + Cloudflare credentials)
  AWS_PROFILE=default npx tsx scripts/sync-ssm-to-wrangler.ts
  ```

## Code Changes Required

- [ ] **Update wrangler.jsonc** with actual D1 database ID
  - Replace `REPLACE_WITH_ACTUAL_ID` with the actual database ID from `npx wrangler d1 list`

- [ ] **Replace Auth Library**
  - Current: `src/lib/auth.ts` (Cognito + next-auth)
  - New: `src/lib/auth-d1.ts` (D1-based sessions)

- [ ] **Update Session Store**
  - Current: `src/lib/session-token-store.ts` (DynamoDB)
  - New: Use D1 queries from `auth-d1.ts`

- [ ] **Replace API Routes**
  - `src/app/api/auth/login/route.ts` - D1 auth instead of Cognito
  - `src/app/api/auth/register/route.ts` - New registration flow needed
  - `src/app/api/auth/logout/route.ts` - D1 session deletion

- [ ] **Update Data Layer**
  - Replace DynamoDB client calls with D1 prepared statements
  - Update: user profiles, stripe transactions, admin notifications

## Breaking Changes to Acknowledge

| Component | Before | After | Migration Complexity |
|-----------|--------|-------|---------------------|
| Login UI | Cognito Hosted UI | Custom form | Medium |
| Password reset | Cognito built-in | Custom flow (email) | High |
| Admin access | `cognito:groups` claim | D1 `user_role` table | Medium |
| Email verification | Cognito automatic | Custom implementation | High |
| MFA | Cognito TOTP/Email | ❌ Not available | High |
| OAuth providers | Google, GitHub via Cognito | ❌ Not available | High |

## Testing Plan

- [ ] **Staging Deployment**

  ```bash
  # Create staging environment
  npx wrangler deploy --env=staging
  ```

- [ ] **Test Authentication Flow**
  - [ ] Register new user
  - [ ] Login/logout
  - [ ] Session persistence
  - [ ] Admin access

- [ ] **Test Data Operations**
  - [ ] User profile CRUD
  - [ ] Stripe webhooks
  - [ ] Admin notifications

- [ ] **Performance Testing**
  - Compare Workers vs Lambda response times
  - Verify under 100K/day request limit

## Cutover Plan

1. **Day 1**: Enable R2/D1, run migrations, deploy to staging
2. **Day 2-3**: Testing and validation
3. **Day 4**: Final sync of DynamoDB → D1
4. **Day 5**: Deploy to production Workers
5. **Day 6-7**: Monitor and verify

## Rollback Procedure

If issues arise within 7 days:

1. **Keep AWS deployment running** in parallel
2. **DNS switch**: Point `cloudless.gr` CNAME back to CloudFront
3. **Data sync**: Run DynamoDB → SSM sync if needed
4. **Monitoring**: Check CloudWatch for errors

## Cost Comparison

| Resource | AWS Monthly | Cloudflare Free | Savings |
|----------|-------------|-----------------|---------|
| Lambda execution | ~$20-50 | $0 | ✅ |
| DynamoDB | ~$10-20 | $0 | ✅ |
| S3 storage | ~$5 | $0 | ✅ |
| Cognito auth | ~$5 | $0 | ✅ |
| SSM params | ~$1 | $0 | ✅ |
| **Total** | **~$40-80** | **$0** | **✅ 100%** |

## Files Created/Modified

| File | Purpose |
|------|---------|
| `docs/MIGRATION-CLOUDFLARE-FREE.md` | Full migration guide |
| `docs/CLOUDFLARE-MIGRATION-CHECKLIST.md` | This checklist |
| `migrations/0001-auth-schema.sql` | D1 database schema |
| `src/lib/auth-d1.ts` | D1-based auth functions |
| `src/lib/cloudflare-config.ts` | Workers configuration helpers |
| `scripts/migrate-dynamodb-to-d1.ts` | Data migration script |
| `scripts/sync-ssm-to-wrangler.ts` | Secret sync script |
| `.github/workflows/deploy-cloudflare-free-tier.yml` | Deployment workflow |
| `wrangler.jsonc` | Added R2 and D1 bindings |
