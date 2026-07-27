# Cloudless.gr Migration - Comprehensive Todo List
*Generated: 2026-07-24 | Updated: 2026-07-28*

---

## 🔴 HIGH PRIORITY - Blocking Production

### Cloudflare API Token Fix (PARTIALLY COMPLETE)
- [x] **CLOUDFLARE_API_TOKEN** - ✅ Set as GitHub secret (~1 day ago)
- [x] **CF_ACCOUNT_ID** - ✅ Set as GitHub secret (~2 days ago)
- [x] **CLOUDFLARE_ZONE_ID** - ✅ Set as GitHub secret (~5 days ago)
- [x] Create `create-r2-credentials.yml` workflow to auto-generate R2 credentials
- [ ] User action: Run `create-r2-credentials.yml` workflow to generate `CF_R2_ACCESS_KEY_ID` and `CF_R2_SECRET_ACCESS_KEY`
- [ ] User action: Set `SESSION_SECRET` via `npx wrangler secret put SESSION_SECRET --config wrangler.jsonc`
- [ ] User action: Set `AGENT_AUTH_TOKEN` via `npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc`
- [ ] **Verify deployment workflow works** with the new token (test a build)

### Google Calendar Configuration (Blocks Calendar Booking)
- [x] **GOOGLE_CLIENT_EMAIL** - ✅ Set as GitHub secret (~1 month ago)
- [x] **GOOGLE_PRIVATE_KEY** - ✅ Set as GitHub secret (~1 month ago)
- [x] **GOOGLE_CALENDAR_ID** - ✅ Set as GitHub secret (~2 days ago)
- [ ] User action: Add `GOOGLE_CLIENT_EMAIL` as Wrangler secret for Workers
- [ ] User action: Add `GOOGLE_PRIVATE_KEY` as Wrangler secret (with \n for newlines)
- [ ] User action: Add `GOOGLE_CALENDAR_ID` as Wrangler secret (defaults to "primary")
- [ ] **Test calendar booking flow** (availability → book slot)

---

## 🟡 MEDIUM PRIORITY - Migration Completion

### ETL Script Migration (Legacy Scripts Deprecated)
- [x] `scripts/etl/clients-to-lake.mjs` - Removed (replaced by `clients-to-r2.mjs`)
- [x] `scripts/etl/portals-to-lake.mjs` - Removed (replaced by `portals-to-r2.mjs`)
- [x] All 10 legacy `-to-lake.mjs` scripts have deprecation notices
- [x] `_r2-config.mjs` updated to fail-fast (no AWS S3 fallback)
- [x] Removed unused AWS SDK packages from `scripts/etl/package.json`

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
- [x] Add deprecation notices to all legacy `-to-lake.mjs` ETL scripts (11 scripts updated)
- [x] Update `_r2-config.mjs` to fail-fast instead of falling back to AWS S3
- [x] Remove unused AWS SDK packages from `scripts/etl/package.json`
- [ ] Update `migrate-all-to-r2.sh` to reflect fail-fast behavior
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
- [x] 10/10 ETL scripts migrated to R2 + D1 config
- [x] Legacy `-to-lake.mjs` files removed (clients-to-lake, portals-to-lake)
- [x] `create-r2-credentials.yml` workflow created (auto-generates R2 credentials)

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
| 🔴 High (Blocking) | 6 | 3/6 |
| 🟡 Medium | 2 | 0/2 |
| 🟢 Low | 6 | 1/6 |
| ✅ Completed | 55+ | Done |

**Next Action:** Run the `create-r2-credentials.yml` workflow to auto-generate R2 credentials, then set `SESSION_SECRET` and `AGENT_AUTH_TOKEN` via Wrangler.
