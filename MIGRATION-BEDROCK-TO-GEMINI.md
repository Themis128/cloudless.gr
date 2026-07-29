# Bedrock to Gemini Migration Plan

## Task: Replace AWS Bedrock + Anthropic with Google Gemini for all AI operations

Generated: 2026-07-21 (Updated)

---

## Summary

Migration from AWS Bedrock/Anthropic to Google Gemini completed for:

- Main chat endpoint (`/api/chat`)
- Chat service worker (`services/chat/src/index.ts`)
- Admin AI assistant (`/api/admin/ai/assistant`)
- Campaign strategy generator (`/api/admin/ai/campaign`)
- Ad copy generator (`/api/admin/ai/copy`)
- Product description generator (`/api/admin/ai/product-descriptions`)
- Internal AI generate (`/api/internal/ai/generate`)
- Search route source labels (meilisearch-bedrock → meilisearch)

## Phase 1: AI Provider Migration (COMPLETED)

### Files Updated

| File | Status |
|------|--------|
| `src/lib/gemini-shared.ts` | ✅ Created - Core Gemini client |
| `src/lib/gemini-admin.ts` | ✅ Created - Admin Gemini wrapper |
| `src/app/api/chat/route.ts` | ✅ Updated - Uses Gemini + Workers AI |
| `services/chat/src/index.ts` | ✅ Updated - Uses Gemini for chat |
| `src/app/api/admin/ai/assistant/route.ts` | ✅ Updated - Uses Gemini |
| `src/app/api/admin/ai/campaign/route.ts` | ✅ Updated - Uses Gemini |
| `src/app/admin/ai/copy/route.ts` | ✅ Updated - Uses Gemini |
| `src/lib/ssm-config-d1.ts` | ✅ Updated - Added GEMINI_API_KEY |

### Fallback Chain (for chat)

1. Workers AI (`@cf/meta/llama-3.1-8b-instruct`) - Primary, fastest
2. Gemini 1.5 Flash (`gemini-1.5-flash`) - Fallback, good token limits (1500/day free)

## Phase 2: AWS Cleanup (COMPLETED)

### Removed from package.json

- `ses:provision` script (SES migrated to Cloudflare Email)
- `cognito:setup`, `cognito:setup:dry`, `cognito:setup:quick` scripts
- `e2e:cognito`, `e2e:cognito:dry` scripts
- `lambda:audit` script
- `@aws-sdk/client-athena`
- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/client-cognito-identity-provider`
- `@aws-sdk/client-cost-explorer`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/client-sesv2`
- `@aws-sdk/client-sns`
- `@aws-sdk/client-ssm`
- `@aws-sdk/client-iam` (dev dependency)
- `@aws-lambda-powertools/logger`

### Remaining AWS SDK (kept for compatibility)

- `@aws-sdk/client-s3` - Used in `scripts/etl/_r2-config.mjs` for R2-compatible storage (R2 uses S3 API)

### Files Updated

- `.env.example` - Removed AWS SSM/S3/Cognito/SES references, added GEMINI_API_KEY
- `.dev.vars.example` - Added GEMINI_API_KEY for local development
- `src/lib/analytics-r2.ts` - Removed S3 fallback, R2-only
- `src/lib/analytics.ts` - Updated documentation for R2-only

## Phase 3: Secrets Required

### Production Secrets (via Wrangler)

```bash
# Required for Gemini integration
npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc --env=""

# Other required secrets
npx wrangler secret put CRON_SECRET --config wrangler.jsonc --env=""
npx wrangler secret put STRIPE_SECRET_KEY --config wrangler.jsonc --env=""
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config wrangler.jsonc --env=""
npx wrangler secret put GOOGLE_CLIENT_EMAIL --config wrangler.jsonc --env=""
npx wrangler secret put GOOGLE_PRIVATE_KEY --config wrangler.jsonc --env=""  
npx wrangler secret put GOOGLE_CALENDAR_ID --config wrangler.jsonc --env=""
```

### Development Secrets (via .dev.vars)

Add to `.dev.vars`:

```
GEMINI_API_KEY=your-gemini-api-key-here
CRON_SECRET=your-cron-secret-here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

### Secrets Already Configured

- SESSION_SECRET ✅
- AGENT_AUTH_TOKEN ✅
- SLACK_WEBHOOK_URL ✅ (2026-07-19)
- ADMIN_ALERT_SECRET ✅ (2026-07-19)
- POSTIZ_API_KEY ✅ (2026-07-19)
- ESPOCRM_API_KEY ✅ (2026-07-19)
- ESPOCRM_API_PASSWORD ✅ (2026-07-19)

## Phase 4: Deployment

```bash
# 1. Typecheck
pnpm cf:typecheck

# 2. Build and deploy
pnpm cloudflare-build && pnpm cf:deploy

# 3. Verify
curl -s https://cloudless.gr/api/health | jq
curl -s -X POST https://cloudless.gr/api/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hello"}]}' | head -10
```

## Notes

- Gemini free tier: 1500 requests/day
- Workers AI free tier: 100K tokens/day
- Both support streaming responses
- Tool calling support available via Gemini's functionDeclarations API
- The `@aws-sdk/client-s3` package is still required for ETL scripts that write to R2 (R2 uses S3-compatible API)
- SSM config still works via fallback but D1 is the primary config source
