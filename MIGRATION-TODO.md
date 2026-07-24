# Cloudless.gr Migration - Comprehensive Todo List
*Generated: 2026-07-24 | Based on all migration docs and existing todo files*

---

## 🔴 HIGH PRIORITY - Blocking Production

### Cloudflare API Token Fix (Blocks Deploy)
- [ ] Create new Cloudflare API Token with "Edit Cloudflare Workers" template
- [ ] Add token as `CLOUDFLARE_API_TOKEN` GitHub repository secret
- [ ] Verify `CLOUDFLARE_ACCOUNT_ID` secret exists (`fb7dc7b69b662480cd5961a4d1913c78`)
- [ ] Trigger a new build to verify the fix works

### Google Calendar Configuration (Blocks Calendar Booking)
- [ ] Add `GOOGLE_CLIENT_EMAIL` as Wrangler secret for Workers
- [ ] Add `GOOGLE_PRIVATE_KEY` as Wrangler secret (with `\n` for newlines)
- [ ] Add `GOOGLE_CALENDAR_ID` as Wrangler secret (defaults to "primary")
- [ ] OR: Add `GOOGLE_CLIENT_EMAIL` and `GOOGLE_CALENDAR_ID` to D1 `app_config` table for k3s

---

## 🟡 MEDIUM PRIORITY - Migration Completion

### ETL Script Migration (2 Remaining from AWS→Cloudflare)
- [ ] `scripts/etl/clients-to-lake.mjs` - Migrate SSM → D1 `app_config`
- [ ] `scripts/etl/portals-to-lake.mjs` - Migrate SSM → D1 `app_config`

### Infrastructure & Operations
- [ ] Restart Cline/Claude desktop to load MCP configuration changes
- [ ] Configure 2TB SSD mount for analytics storage (`/sdb1` on omv)

---

## 🟢 LOW PRIORITY - Nice to Have

### Testing & Verification
- [ ] Verify `clients-to-r2.mjs` deployment works end-to-end
- [ ] Run full ETL pipeline on Pi runners to verify no SSM/AWS dependencies
- [ ] Run Playwright E2E tests against production (cloudless.gr and pi-origin.cloudless.gr)

### Code Quality
- [ ] Clean up legacy ETL scripts (`espocrm-to-lake.mjs`, `clients-to-lake.mjs`, `portals-to-lake.mjs`) once new versions verified
- [ ] Remove AWS SDK imports from fully migrated files
- [ ] Update any remaining docs referencing old AWS architecture

---

## ✅ COMPLETED - Reference Only

### AWS-to-Cloudflare Migration (ALL COMPLETE ✅)
- [x] SSM Parameter Store → D1 `app_config` + Wrangler secrets
- [x] S3 → R2 (`@aws-sdk/client-s3` with R2 endpoint)
- [x] DynamoDB → D1 (`user-auth-db`)
- [x] SES → Cloudflare Email (workers.dev)
- [x] Bedrock → Workers AI (`@cf/meta/llama-3.1-8b-instruct`)
- [x] Cognito → D1-based auth
- [x] All 5 Wrangler secrets migrated (ADMIN_ALERT_SECRET, ESPOCRM_API_KEY, ESPOCRM_API_PASSWORD, SLACK_WEBHOOK_URL, POSTIZ_API_KEY)
- [x] 5/5 ETL scripts migrated to R2 + D1 config

### Authentication Security Hardening (ALL COMPLETE ✅)
- [x] Password strength validation (min 8 chars, mixed case, number, symbol)
- [x] PBKDF2 secure password hashing (backward compatible with SHA-256)
- [x] Rate limiting on auth endpoints (max 10 attempts/minute)
- [x] CSRF protection utility + migration 0004
- [x] Account lockout (>5 failed attempts in 15 min)
- [x] Email verification flow (OTP via SES)
- [x] "Remember me" option (60 days vs 30)
- [x] Password reset rate limiting (max 3 requests/hour)
- [x] Session activity logging (login IPs/timestamps)
- [x] Multi-session support
- [x] Admin audit log (migration 0005 + auth-audit.ts + /api/admin/auth-audit)
- [x] Auth middleware utility (auth-middleware.ts)
- [x] OpenAPI documentation (auth-openapi.ts)
- [x] Auth testing sandbox (/api/auth/sandbox)
- [x] SESSION_SECRET validation (32+ bytes)
- [x] D1 binding verification in wrangler.jsonc
- [x] /api/config endpoint for ETL scripts (migration 0007)

### Infrastructure (ALL COMPLETE ✅)
- [x] R2 buckets created (cloudless-assets, cloudless-analytics, app-media-bucket, datalake-bucket)
- [x] D1 database created (user-auth-db)
- [x] Cloudflare Tunnel ACTIVE (11/11 services operational)
- [x] MinIO credentials secured (random hex, not defaults)
- [x] PostgreSQL secret in k3s
- [x] D1 auth connection verified
- [x] Session endpoint returning 200
- [x] User/role sync complete (55 users, 54 roles)

### API Endpoint Fixes (COMPLETE ✅)
- [x] /api/config/route.ts - Added GOOGLE_CLIENT_EMAIL, GOOGLE_CALENDAR_ID to public keys
- [x] Calendar endpoints return 503 when unconfigured (correct behavior)
- [x] Chat tools return helpful message when calendar not configured
- [x] /api/agent/book returns 503 when calendar not configured

### OpenNext Build/Deploy Migration (COMPLETE ✅)
- [x] open-next.config.ts migrated to defineCloudflareConfig()
- [x] R2 incremental cache + D1 tag cache configured
- [x] cf:build, cf:deploy, cf:preview scripts working

---

## 📋 Summary

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 High (Blocking) | 8 | 0/8 |
| 🟡 Medium | 4 | 0/4 |
| 🟢 Low | 5 | 0/5 |
| ✅ Completed | 50+ | Done |

**Next Action:** Start with **Cloudflare API Token Fix** (blocks all deployments), then **Google Calendar Configuration** (enables booking feature).