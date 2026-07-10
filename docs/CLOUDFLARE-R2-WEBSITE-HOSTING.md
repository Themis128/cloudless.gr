# Cloudflare R2 Website Hosting - Configured

## R2 Bucket: `cloudless-assets` (ASSETS_BUCKET)
- Location: EEUR (Europe) ✅
- Storage Class: Standard
- Objects: 3 ✅
- Status: ✅ index.html uploaded and accessible

## Policies Applied

### Public Access
- Status: ⚠️ **Manual step required** in Dashboard
- Location: Workers & Pages → R2 → cloudless-assets → Settings → Enable "Public bucket"

### CORS Policy
- Status: ⚠️ **Manual step required** in Dashboard
- Location: Workers & Pages → R2 → cloudless-assets → CORS
- Or use `scripts/r2-cors-policy.js` with S3 API credentials

```json
CORSRules: [{
  AllowedOrigins: ["*"],
  AllowedMethods: ["GET", "HEAD"],
  AllowedHeaders: ["*"],
  MaxAgeSeconds: 86400
}]
```

## Worker Configuration

### Configuration Files
- `wrangler.json` - Main production config ✅
- `wrangler-cloudflare-free.json` - Free tier deployment config ✅

### Bindings
| Binding | Resource | Status |
|---------|----------|--------|
| `ASSETS_BUCKET` | cloudless-assets | ✅ Connected |
| `MEDIA_BUCKET` | app-media-bucket | ✅ Connected |
| `ANALYTICS_BUCKET` | cloudless-analytics | ✅ Connected |
| `DATALAKE_BUCKET` | datalake-bucket | ✅ Connected |
| `AUTH_DB` | user-auth-db (D1) | ✅ Connected |
| `AI` | Workers AI | ✅ Connected |
| `EMAIL` | Email Sending | ⚠️ Requires Email Routing setup |

### Worker Code
- `src/index-cloudflare-free.js` - 4-layer architecture ✅
  - Layer 1: D1 Authentication (register, login, logout, session, reset-password)
  - Layer 2: R2 Storage (static assets with SPA fallback)
  - Layer 3: DuckDB-Wasm analytics (parquet streaming)
  - Layer 4: Admin endpoints (user promotion)

## Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/health` | GET | Health check | ✅ Working |
| `/api/auth/register` | POST | User registration | ✅ Working |
| `/api/auth/login` | POST | User login | ✅ Working |
| `/api/auth/logout` | POST | Session logout | ✅ Working |
| `/api/auth/session` | GET | Session validation | ✅ Working |
| `/api/auth/reset-password` | POST | Password reset request | ✅ Working |
| `/api/auth/reset-confirm` | POST | Confirm password reset | ✅ Working |
| `/api/analytics/r2` | GET | Parquet file streaming | ✅ Working |
| `/api/analytics/query` | GET | List parquet files | ✅ Working |
| `/api/admin/users/promote` | POST | Promote user to admin | ✅ Working |

## Secrets Configured

| Secret | Status |
|--------|--------|
| `AUTH_SECRET` | ✅ Set |
| `SESSION_SECRET` | ✅ Set |
| `COGNITO_CLIENT_ID` | ✅ Set |
| `COGNITO_CLIENT_SECRET` | ✅ Set |
| `COGNITO_DOMAIN` | ✅ Set |
| `COGNITO_ISSUER` | ✅ Set |
| `STRIPE_SECRET_KEY` | ✅ Set |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set |
| `SES_FROM_EMAIL` | ✅ Set |
| `SES_TO_EMAIL` | ✅ Set |

## Next Steps

1. **Enable Email Routing** in Cloudflare Dashboard:
   - Workers & Pages → Email → Email Routing → Enable
   - Configure sending address: `noreply@cloudless.gr`

2. **Enable Public Bucket** for cloudless-assets:
   - Workers & Pages → R2 → cloudless-assets → Settings → Enable "Public bucket"

3. **Configure CORS** for cloudless-assets:
   - Workers & Pages → R2 → cloudless-assets → CORS → Add rule

4. **Migrate Full Static Site** (optional):
   ```bash
   pnpm cf:build && pnpm cf:r2:upload-dir && pnpm cf:deploy:free
   ```

## Worker Deployment

- Worker URL: `https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev`
- Latest deployment: Multiple deployments active (latest: 2026-07-10)
- Health check: `{"status":"ok","dbConnected":true}` ✅