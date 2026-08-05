# ETL Pipeline Migration to Cloudflare-Only Infrastructure

This document describes the changes made to migrate the ETL pipelines from AWS to Cloudflare-only infrastructure.

## Summary of Changes

### 1. AWS Cognito Removed from `clients-to-r2.mjs`

**Before:** The script used `@aws-sdk/client-cognito-identity-provider` to fetch users from AWS Cognito User Pool.

**After:** The script now fetches users from:
- Internal API endpoint: `/api/internal/users`
- Falls back to D1 database config if API is unavailable

**Files Modified:**
- `scripts/etl/clients-to-r2.mjs` - Main ETL script for users

### 2. New Internal API Endpoint for Users

**Created:** `src/app/api/internal/users/route.ts`

This endpoint provides access to the `user` table in Cloudflare D1, replacing the Cognito User Pool.

**Endpoint:** `GET /api/internal/users`

**Response Format:**
```json
{
  "users": [
    {
      "user_id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "company": "Company",
      "phone": "+1234567890",
      "signup_date": "2024-01-01T00:00:00.000Z",
      "last_login": "2024-01-02T00:00:00.000Z",
      "email_verified": true
    }
  ],
  "count": 100
}
```

### 3. LinkedIn Ads Scripts Updated (`linkedin-ads-to-lake.mjs`)

**Before:** Used AWS SSM to fetch LinkedIn access tokens.

**After:** Uses `LINKEDIN_ACCESS_TOKEN` environment variable directly.

The `linkedin-ads-to-r2.mjs` was already migrated, so no changes were needed there.

### 4. AWS Cost Explorer Scripts (`aws-cost-to-lake.mjs`, `aws-cost-to-r2.mjs`)

**Status:** These scripts remain AWS-dependent as they specifically fetch AWS billing data.

**Migration Options:**
1. Set `USE_AWS_COST=0` to disable (if no longer using AWS)
2. Keep AWS credentials in Wrangler secrets if AWS is still in use
3. Replace with Cloudflare billing export or third-party tools

## Environment Variables Required

For the ETL scripts to work, ensure these are configured:

### Cloudflare R2 Credentials
```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
# or: CF_ACCOUNT_ID=<your-account-id>
CF_R2_ACCESS_KEY_ID=<your-access-key>
CF_R2_SECRET_ACCESS_KEY=<your-secret-key>
```

### API URLs (if using external configs)
```bash
AUTH_DB_URL=http://localhost:8787/api/config
USERS_API_URL=http://localhost:8787/api/internal/users
```

### LinkedIn Access (for LinkedIn Ads ETL)
```bash
LINKEDIN_ACCESS_TOKEN=<token>
# or: LINKEDIN_CAPI_ACCESS_TOKEN=<token>
```

### Optional: Disable AWS Scripts
```bash
USE_AWS_COST=0  # Set to skip AWS Cost Explorer ETL
```

## Running the ETL Scripts

### Test Individual Scripts
```bash
node scripts/etl/clients-to-r2.mjs
node scripts/etl/linkedin-ads-to-r2.mjs
node scripts/etl/aws-cost-to-r2.mjs  # Only if USE_AWS_COST=1
```

### Test JSON Output
The script will now output JSON format instead of Parquet when `@dsnp/parquetjs` is not available. To use Parquet in production, ensure the package is installed in the etl directory.

## Files Modified

1. `scripts/etl/clients-to-r2.mjs` - Removed AWS Cognito, added Cloudflare D1/API fetching
2. `scripts/etl/linkedin-ads-to-lake.mjs` - Removed AWS SSM dependency
3. `scripts/etl/aws-cost-to-lake.mjs` - Made AWS optional with environment flag
4. `scripts/etl/aws-cost-to-r2.mjs` - Made AWS optional with environment flag
5. `src/app/api/internal/users/route.ts` - NEW endpoint for fetching users

## Testing Checklist

- [ ] Verify `node --check` passes on all modified scripts
- [ ] Set up environment variables in `.env.local` or GitHub secrets
- [ ] Test `fetchUsersFromApi()` returns valid user data
- [ ] Verify R2 credentials work with `r2Put()` function
- [ ] Run full ETL pipeline and verify output in R2

## Troubleshooting

### "Missing CLOUDFLARE_ACCOUNT_ID"
Set the environment variable in your environment or GitHub secrets.

### "Missing R2 credentials"
Ensure `CF_R2_ACCESS_KEY_ID` and `CF_R2_SECRET_ACCESS_KEY` are set.

### Users API returns empty
Check that:
1. The `/api/internal/users` endpoint exists and is accessible
2. The API URL is correct (`AUTH_DB_URL` environment variable)
3. D1 database has users in the `user` table

### "Cannot find package @aws-sdk/client-cognito-identity-provider"
This error has been resolved by removing the AWS SDK dependency from the clients-to-r2.mjs script.

## Next Steps

1. Deploy the new API endpoint:
```bash
wrangler deploy
```

2. Update GitHub Actions workflow to use new environment variables:
```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CF_R2_ACCESS_KEY_ID: ${{ secrets.CF_R2_ACCESS_KEY_ID }}
  CF_R2_SECRET_ACCESS_KEY: ${{ secrets.CF_R2_SECRET_ACCESS_KEY }}
```

3. Consider adding Parquet support by installing the package:
```bash
cd scripts/etl && npm install @dsnp/parquetjs
```
