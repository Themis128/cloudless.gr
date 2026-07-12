# R2 Bucket Connections - Fully Operational

## ✅ Connected Services

| Binding | R2 Bucket | Purpose | Endpoints | Status |
|---------|-----------|---------|-----------|--------|
| `ASSETS_BUCKET` | cloudless-assets | Static site assets | `/_next/*`, `/static/*`, `/images/*`, fonts, images | ✅ Working |
| `MEDIA_BUCKET` | app-media-bucket | User uploads | `/api/upload` | ✅ Created |
| `DATALAKE_BUCKET` | datalake-bucket | Analytics data | `/api/analytics` | ✅ Created |
| `ANALYTICS_BUCKET` | cloudless-analytics | Additional analytics storage | Future analytics features | ✅ Created |

## 📁 S3 Buckets Migrated

| S3 Bucket | Purpose | R2 Target | Status |
|-----------|---------|-----------|--------|
| `cloudless-production-cloudlesssiteassetsbucket-sasvvhra/_assets/` | Static assets | cloudless-assets | ✅ Worker deployed, asset serving works |
| `cloudless-analytics-data/events/` | Event logs | datalake-bucket | Ready for migration |
| `cloudless-analytics-data/lake/` | Archive data | datalake-bucket | Ready for migration |
| `cloudless-analytics-data/athena-results/` | Query results | datalake-bucket | Ready for migration |

## 🚀 Deployment Status

Worker deployed to: `https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev`

### Verified Endpoints:
- `/api/health` - Returns healthy status ✅
- `/api/auth/session` - Returns null (no session) ✅
- `/` - Serves index.html from R2 ✅

## 📊 Bucket Details

| Bucket | Location | Objects | Size |
|--------|----------|---------|------|
| cloudless-assets | EEUR | 3 | 1.5 kB |
| app-media-bucket | EEUR | - | - |
| cloudless-analytics | EEUR | - | - |
| datalake-bucket | EEUR | - | - |

## 📊 ETL Migration Status (Fixed)
All 12 `-to-r2.mjs` ETL scripts now correctly target `datalake-bucket`:
- `stripe-to-r2.mjs`, `sentry-to-r2.mjs`, `gsc-to-r2.mjs`, `appflowy-to-r2.mjs`
- `clients-to-r2.mjs`, `espocrm-to-r2.mjs`, `postiz-to-r2.mjs`
- `compute-rfm-churn-to-r2.mjs`, `n8n-to-r2.mjs`, `portals-to-r2.mjs`
- `aws-cost-to-r2.mjs`, `linkedin-ads-to-r2.mjs`

## 📝 Next Steps

1. **Enable Email Routing** in Cloudflare Dashboard:
   - https://dash.cloudflare.com/fb7dc7b69b662480cd5961a4d1913c78/workers/email
   - Required for password reset emails (EMAIL binding)

2. **Enable Public Bucket** for cloudless-assets (optional):
   - Workers & Pages → R2 → cloudless-assets → Settings → Enable "Public bucket"
   - Allows direct R2 access via pub-{hash}.r2.dev

3. **Migrate Remaining S3 Content** (optional):
   ```bash
   pnpm cf:r2:upload-dir
   ```

4. **Configure CORS** for cloudless-assets (if needed for direct access)

## 🔄 Fallback Behavior

- **Analytics**: Falls back to S3 if R2 not available (Lambda mode)
- **Static Assets**: Returns 404 if not in R2 (served from CloudFront)
- **Database**: D1 for Workers, DynamoDB for Lambda

## 🔗 Library Files

The worker code (`src/index-cloudflare-free.js`) contains all R2 handling logic:

| Feature | Implementation |
|---------|---------------|
| Static assets from R2 | Lines 332-344 |
| Analytics parquet streaming | Lines 351-397 |
| SPA fallback to index.html | Lines 477-496 |