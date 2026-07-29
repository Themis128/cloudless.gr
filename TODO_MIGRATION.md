# Cloudless.gr Migration Todo List - Updated 2026-07-25

## 🚨 HIGH PRIORITY - COMPLETED ✅

### 1. Cloudflare API Token Setup - FIXED

**Status: COMPLETE**

- Fixed inconsistent `CF_ACCOUNT_ID` variable in GitHub Actions workflows
- Updated `.github/workflows/deploy-cloudflare.yml` to use correct `cloudflare-account-id` secret
- Updated `.github/workflows/preview.yml` to use correct `cloudflare-account-id` secret
- **Action Required**: Add `CLOUDFLARE_API_TOKEN` and `cloudflare-account-id` secrets to GitHub repository settings

### 2. Google Calendar Configuration - CONFIG READY, VALUES NEEDED

**Status: CONFIG READY / NEEDS VALUES**

- D1 `app_config` table (migration 0007) already has the keys:
  - `GOOGLE_CLIENT_EMAIL` - ready for service account email
  - `GOOGLE_CALENDAR_ID` - defaulted to 'primary'
  - `GOOGLE_PRIVATE_KEY` - should be in Wrangler secrets (not D1)
- `/api/config/route.ts` already exposes `GOOGLE_CLIENT_EMAIL` and `GOOGLE_CALENDAR_ID` for ETL scripts
- Calendar endpoints already use `isConfiguredAsync` which checks env → SSM → D1
- **Action Required**: Populate D1 values + add `GOOGLE_PRIVATE_KEY` as Wrangler secret

---

## 🔧 MEDIUM PRIORITY - COMPLETED ✅

### 3. ETL Scripts Migration (SSM → D1 + R2) - COMPLETE

**Status: COMPLETE**

| Script | Status | Changes Made |
|--------|--------|--------------|
| `scripts/etl/clients-to-r2.mjs` | ✅ COMPLETE | Migrated to use `loadConfigFromD1()` + `getS3Client()` for R2 |
| `scripts/etl/portals-to-lake.mjs` | ✅ COMPLETE | New file created with D1 + R2 integration |
| `scripts/etl/espocrm-to-r2.mjs` | ✅ COMPLETE | Already migrated (uses `_r2-config.mjs` + GitHub secrets) |
| `scripts/etl/linkedin-ads-to-lake.mjs` | ✅ COMPLETE | Already migrated |
| `scripts/etl/postiz-to-lake.mjs` | ✅ COMPLETE | Already migrated |
| `scripts/etl/appflowy-to-lake.mjs` | ✅ COMPLETE | Already migrated |
| `scripts/etl/clients-to-lake.mjs` | ⚠️ LEGACY | Legacy S3/SSM version - use `clients-to-r2.mjs` instead |
| `scripts/etl/espocrm-to-lake.mjs` | ⚠️ LEGACY | Legacy S3/SSM version - use `espocrm-to-r2.mjs` instead |

---

## 📋 LOW PRIORITY - PENDING

### 4. Testing & Verification

- [ ] Run E2E tests against preview deployment
- [ ] Verify Cloudflare Worker deployment succeeds with new workflow
- [ ] Test calendar availability endpoint with actual Google credentials
- [ ] Verify preview deployments work correctly

### 5. Documentation Updates

- [ ] Update README.md with new deployment workflow
- [ ] Update any docs referencing old AWS architecture (SSM, S3, Bedrock)
- [ ] Document Google Calendar setup procedure in USE-CASES.md

### 6. Operational Items (Manual)

- [ ] **Restart Cline** to load MCP configuration changes
- [ ] **Configure 2TB SSD mount** on omv node for analytics storage
- [ ] Add GitHub secrets: `CLOUDFLARE_API_TOKEN`, `cloudflare-account-id`
- [ ] Add Wrangler secret: `GOOGLE_PRIVATE_KEY` (with `\n` for newlines)
- [ ] Populate D1 `app_config` with `GOOGLE_CLIENT_EMAIL`

---

## 📝 Migration Summary

### Architecture Migration Complete:

- ✅ **SSM → D1**: Configuration moved to D1 `app_config` table (migration 0007)
- ✅ **S3 → R2**: All ETL scripts use R2 via `getS3Client()` from `_r2-config.mjs`
- ✅ **Bedrock → Workers AI**: Chat widget uses `@cf/meta/llama-3.1-8b-instruct`
- ✅ **SES → Cloudflare Email**: Email sending via Workers binding
- ✅ **DynamoDB → D1**: Session store and user auth use D1

### GitHub Actions Fixed:

- ✅ `.github/workflows/deploy-cloudflare.yml` - Uses correct secrets
- ✅ `.github/workflows/preview.yml` - Uses correct secrets
- ✅ `.github/workflows/etl-espocrm-to-r2.yml` - Uses GitHub secrets (no SSM)

### New Files Created:

- `scripts/etl/portals-to-lake.mjs` - New R2 + D1 version
- `migrations/0007-app-config.sql` - D1 configuration table
- `src/lib/ssm-config-d1.ts` - D1 config loader for Workers

### Files Updated:

- `src/app/api/config/route.ts` - Exposes Google Calendar config for ETL
- `src/lib/integrations.ts` - Async config with D1 fallback (already had pattern)
- `.github/workflows/deploy-cloudflare.yml` - Fixed CF_ACCOUNT_ID
- `.github/workflows/preview.yml` - Fixed CF_ACCOUNT_ID
